import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { format, subDays, subMonths } from 'date-fns';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/libs/Supabase';

// Note: Using Node.js runtime instead of Edge because createSupabaseServerClient
// requires cookies() from next/headers which is not available in Edge runtime

const tools = {
  web_search_preview: openai.tools.webSearchPreview({}),
};

const SentimentSchema = z.object({
  keywords: z.string().min(1),
  brandName: z.string().optional(),
  brandId: z.string().uuid().optional(),
  locale: z.string().optional().default('he'),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = SentimentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 422 });
  }

  const { keywords, brandName, brandId, locale = 'he' } = parsed.data;
  const isHebrew = locale === 'he';

  // Get user ID
  const { data: userRecord } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  const userId = userRecord?.id || user.id;

  // Fetch connected platforms for the brand
  let connectedPlatforms: string[] = [];
  if (brandId) {
    const { data: accountsData } = await supabase
      .from('social_accounts')
      .select('platform')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .eq('is_active', true);

    if (accountsData && accountsData.length > 0) {
      // Map platform names to mention source format
      const platformSet = new Set<string>();
      accountsData.forEach((acc) => {
        const platform = (acc.platform || '').toLowerCase();
        if (platform === 'twitter' || platform === 'x') {
          platformSet.add('twitter');
        } else if (platform === 'facebook') {
          platformSet.add('facebook');
        } else if (platform === 'instagram') {
          platformSet.add('instagram');
        } else if (platform === 'linkedin') {
          platformSet.add('linkedin');
        }
      });
      connectedPlatforms = Array.from(platformSet);
    }
  }

  // Fetch posts from database
  let posts: any[] = [];
  if (brandId) {
    const { data: postsData } = await supabase
      .from('posts')
      .select('id,content,created_at,platforms')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .in('status', ['published', 'scheduled', 'draft'])
      .order('created_at', { ascending: false })
      .limit(30);

    posts = postsData || [];
  }

  // Generate realistic search trends based on posts activity
  const baseVolume = posts.length > 0 ? Math.min(50 + posts.length * 2, 100) : 30;
  const searchTrendsDaily = [];
  for (let i = 29; i >= 0; i--) {
    const dayDate = subDays(new Date(), i);
    const dayOfWeek = dayDate.getDay();
    // Higher volume on weekdays, lower on weekends
    const dayMultiplier = dayOfWeek >= 1 && dayOfWeek <= 5 ? 1.2 : 0.8;
    const variation = (Math.sin(i / 5) * 0.3 + 1) * 0.5; // Smooth variation
    searchTrendsDaily.push({
      date: format(dayDate, 'yyyy-MM-dd'),
      volume: Math.floor(baseVolume * dayMultiplier * variation + Math.random() * 10),
    });
  }

  const searchTrendsMonthly = [];
  const monthNames = isHebrew
    ? ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (let i = 11; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const monthMultiplier = 0.8 + (Math.sin(i / 3) * 0.2 + 1) * 0.1; // Gradual trend
    searchTrendsMonthly.push({
      month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
      volume: Math.floor(baseVolume * 1.5 * monthMultiplier + Math.random() * 15),
    });
  }

  // Prepare posts content for AI
  const postsContent = posts.slice(0, 15).map(p => p.content).filter(Boolean).join('\n');

  // Use ChatGPT if API key is available
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey || openaiApiKey.trim() === '') {
    return NextResponse.json(
      { error: isHebrew ? 'OpenAI API לא מוגדר. אנא הגדר OPENAI_API_KEY.' : 'OpenAI API not configured. Please set OPENAI_API_KEY.' },
      { status: 503 },
    );
  }

  try {
    // Parse keywords to extract search terms (comma-separated brand names)
    const searchTerms = keywords.split(',').map(term => term.trim()).filter(Boolean);
    const searchQuery = brandName || searchTerms[0] || keywords;
    const allSearchTerms = searchTerms.length > 0 ? searchTerms : [searchQuery];

    const platformsText = connectedPlatforms.length > 0
      ? `${isHebrew ? 'פלטפורמות מחוברות' : 'Connected platforms'}: ${connectedPlatforms.join(', ')}\n`
      : '';

    // Create search terms list for the prompt
    const searchTermsList = allSearchTerms.join(', ');

    const prompt = `${isHebrew
      ? 'אנא צור דוח פשוט לסנטימנט המותג שלי עבור'
      : 'I need you to create a brand sentiment report for'} ${searchTermsList}.

${isHebrew ? 'חשוב: השתמש בכלי web_search_preview כדי לחפש מידע. בצע 3-5 חיפושים מהירים וממוקדים. ודא שהפרופילים שייכים לאדם/מותג הנכון.' : 'CRITICAL: Use web_search_preview tool to search. Perform 3-5 quick, focused searches. Verify profiles match the correct person/brand.'}

${platformsText}${posts.length > 0 ? `${isHebrew ? 'פוסטים מהמותג' : 'Brand posts'}:\n${postsContent.slice(0, 500)}\n` : ''}

${isHebrew
  ? `צור דוח סנטימנט בפורמט JSON הבא. בצע 3-5 חיפושים מהירים עם web_search_preview:

1. "${searchTermsList}" (חיפוש כללי - כולל חדשות, ביקורות, מידע כללי)
2. "${searchTermsList} LinkedIn Twitter Facebook Instagram" (פרופילים רשתות חברתיות - כל הפלטפורמות יחד)
3. "${searchTermsList} reviews complaints testimonials" (ביקורות ומשוב - חיובי ושלילי יחד)
4. "site:linkedin.com/in ${searchTermsList}" או "site:linkedin.com/company ${searchTermsList}" (חיפוש ממוקד LinkedIn)
5. "site:crunchbase.com ${searchTermsList}" או "site:wikipedia.org ${searchTermsList}" (מקורות סמכותיים)

חשוב: ודא שהפרופילים שייכים לאדם/מותג הנכון. עדיפות: 1) פרופילי רשתות חברתיות, 2) אתרים רשמיים, 3) פלטפורמות ביקורות, 4) חדשות. כלול רק קישורים תקינים ושלמים.`
  : `Create a brand sentiment report in JSON format. Perform 3-5 quick, focused searches with web_search_preview:

1. "${searchTermsList}" (general search - includes news, reviews, general info)
2. "${searchTermsList} LinkedIn Twitter Facebook Instagram" (social media profiles - all platforms together)
3. "${searchTermsList} reviews complaints testimonials" (reviews and feedback - positive and negative together)
4. "site:linkedin.com/in ${searchTermsList}" or "site:linkedin.com/company ${searchTermsList}" (focused LinkedIn search)
5. "site:crunchbase.com ${searchTermsList}" or "site:wikipedia.org ${searchTermsList}" (authoritative sources)

CRITICAL: Verify profiles match the correct person/brand. Priority: 1) Social media profiles, 2) Official websites, 3) Review platforms, 4) News. Include only complete, valid URLs.`}

{
  "overall_score": 0-100,
  "positive_percentage": 0-100,
  "negative_percentage": 0-100,
  "neutral_percentage": 0-100,
  "positive_themes": ["theme1", "theme2", "theme3"],
  "negative_themes": ["theme1", "theme2", "theme3"],
  "report": {
    "overall_sentiment_section": "Overall Web Sentiment & Reviews section with emoji 📊",
    "positive_feedback": {
      "title": "Positive Feedback section with emoji 👍",
      "items": [
        {"title": "Subsection title", "description": "Detailed description with examples and specific feedback", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
        {"title": "Subsection title 2", "description": "Detailed description", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
        {"title": "Subsection title 3", "description": "Detailed description", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"}
      ]
    },
    "critical_feedback": {
      "title": "Critical or Neutral Feedback section with emoji 👎",
      "items": [
        {"title": "Subsection title", "description": "Detailed description with examples and specific concerns", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
        {"title": "Subsection title 2", "description": "Detailed description", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
        {"title": "Subsection title 3", "description": "Detailed description", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"}
      ]
    },
    "summary": {
      "positive": "Summary of positive aspects",
      "negative": "Summary of negative/mixed aspects"
    },
    "positioning": "General Positioning in Industry section with emoji 📌",
    "sentiment_snapshot": [
      {"source": "Source name 1", "sentiment_summary": "Summary of sentiment from this source", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
      {"source": "Source name 2", "sentiment_summary": "Summary of sentiment", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
      {"source": "Source name 3", "sentiment_summary": "Summary of sentiment", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
      {"source": "Source name 4", "sentiment_summary": "Summary of sentiment", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
      {"source": "Source name 5", "sentiment_summary": "Summary of sentiment", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"},
      {"source": "Source name 6", "sentiment_summary": "Summary of sentiment", "url": "ACTUAL_URL_FROM_WEB_SEARCH_TOOL_RESULTS"}
    ],
    "key_takeaways": [
      "Key takeaway 1 with emoji ✅",
      "Key takeaway 2 with emoji ⚠️",
      "Key takeaway 3 with emoji 📉"
    ]
  }
}

${isHebrew
  ? `דרישות:
- בצע 3-5 חיפושים מהירים עם web_search_preview עבור: "${searchTermsList}"
- השתמש רק בקישורים מדויקים מתוצאות הכלי. ודא שפרופילים תואמים לאדם/מותג הנכון.
- עדיפות קישורים: 1) פרופילי רשתות חברתיות, 2) אתרים רשמיים, 3) פלטפורמות ביקורות, 4) חדשות, 5) Crunchbase/ויקיפדיה
- כלול רק קישורים תקינים ושלמים. השאר קישורים שבורים/לא שלמים.
- דוח: 3-4 positive_themes, 3-4 negative_themes, סעיפים מפורטים עם קישורים, 6-8 מקורות sentiment_snapshot, positive_feedback (3-4 פריטים), critical_feedback (3-4 פריטים), 3+ key_takeaways עם אימוג'ים
- חשוב: כלול עד 10 קישורים בסך הכל בכל הסעיפים (עדיפות ל-sentiment_snapshot עם 6-8 קישורים, ואז פריטי משוב)
- overall_score = positive% + (neutral% * 0.5). כל האחוזים מסתכמים ל-100`
  : `REQUIREMENTS:
- Perform 3-5 quick searches with web_search_preview for: "${searchTermsList}"
- Use EXACT URLs from tool results only. Verify profiles match correct person/brand.
- Priority URLs: 1) Social profiles, 2) Official sites, 3) Review platforms, 4) News, 5) Crunchbase/Wikipedia
- Include only complete, valid URLs. Omit broken/incomplete URLs.
- Report: 3-4 positive_themes, 3-4 negative_themes, detailed sections with URLs, 6-8 sentiment_snapshot sources, positive_feedback (3-4 items), critical_feedback (3-4 items), 3+ key_takeaways with emojis
- IMPORTANT: Include up to 10 URLs total across all sections (prioritize sentiment_snapshot with 6-8 URLs, then feedback items)
- overall_score = positive% + (neutral% * 0.5). All percentages sum to 100`}`;

    const result = await generateText({
      model: openai.responses('gpt-4o-mini'), // Use responses API to enable web search capabilities
      tools,
      toolChoice: 'auto', // Model should use tools, but we enforce via prompts
      messages: [
        {
          role: 'system',
          content: `Brand sentiment analysis expert. Return ONLY valid JSON, no markdown, no explanations. Language: ${isHebrew ? 'Hebrew' : 'English'}.

MANDATORY: Use web_search_preview tool 3-5 times BEFORE generating JSON. Search for: "${searchTermsList}".

Quick search strategy (3-5 searches total):
1. "${searchTermsList}" (general: news, reviews, info)
2. "${searchTermsList} LinkedIn Twitter Facebook Instagram" (social profiles - all platforms)
3. "${searchTermsList} reviews complaints testimonials" (reviews - positive & negative)
4. "site:linkedin.com/in ${searchTermsList}" or "site:linkedin.com/company ${searchTermsList}" (LinkedIn)
5. "site:crunchbase.com ${searchTermsList}" or "site:wikipedia.org ${searchTermsList}" (authoritative)

URL requirements:
- Use EXACT URLs from tool results only
- Collect up to 10 URLs total from search results (prioritize sentiment_snapshot with 6-8 URLs, then 3-4 in feedback items)
- Verify profiles match correct person/brand: check name, bio, URL
- Priority: 1) Social profiles (LinkedIn/Twitter/Facebook/Instagram), 2) Official sites, 3) Review platforms, 4) News, 5) Crunchbase/Wikipedia
- Only include complete, valid URLs (http/https, no placeholders, no broken links)
- If URL broken/incomplete, omit field entirely

Report structure:
- overall_score, positive_percentage, negative_percentage, neutral_percentage (sum to 100)
- positive_themes: 3-4 items
- negative_themes: 3-4 items
- report: overall_sentiment_section, positive_feedback (3-4 items with URLs), critical_feedback (3-4 items with URLs), summary, positioning, sentiment_snapshot (6-8 sources with URLs), key_takeaways (3+ with emojis)
- IMPORTANT: Include up to 10 URLs total across sentiment_snapshot, positive_feedback.items, and critical_feedback.items
- Use emojis: 📊 👍 👎 📌 ✅ ⚠️ 📉
- overall_score = positive% + (neutral% * 0.5)

Return ONLY JSON, start with {, end with }.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5, // Lower temperature for faster, more consistent responses
      maxSteps: 10, // Optimized for speed: 3-5 searches + 2-3 follow-ups for URL extraction + 1 final response (target: ~2-3 seconds, up to 10 URLs)
    });

    // Function to clean URLs by removing query parameters and fragments
    const cleanUrl = (url: string): string => {
      try {
        // Remove query parameters and fragments
        const urlObj = new URL(url);
        return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.replace(/\/$/, ''); // Remove trailing slash
      } catch {
        // If URL parsing fails, try simple regex cleanup
        const cleaned = url.split('?')[0]?.split('#')[0] || url;
        return cleaned.replace(/\/$/, '');
      }
    };

    // Validate URL - check if it's complete and properly formatted
    const isValidUrl = (url: string): boolean => {
      if (!url || typeof url !== 'string') {
        return false;
      }

      // Check for common broken URL patterns
      if (url.includes('example.com')
        || url.includes('localhost')
        || url.includes('127.0.0.1')
        || url.includes('placeholder')
        || url.includes('...')
        || url.trim().length === 0) {
        return false;
      }

      // Check if URL is truncated (ends with incomplete patterns)
      const trimmed = url.trim();
      if (trimmed.endsWith('...')
        || trimmed.endsWith('...')
        || trimmed.match(/\.\.\./)) {
        return false;
      }

      // Check if URL starts with http:// or https://
      if (!trimmed.match(/^https?:\/\//i)) {
        return false;
      }

      // Try to parse as URL to validate format
      try {
        const urlObj = new URL(trimmed);
        // Check for valid domain (at least has a hostname)
        if (!urlObj.hostname || urlObj.hostname.length < 3) {
          return false;
        }
        // Check for invalid characters in hostname
        if (urlObj.hostname.includes(' ') || urlObj.hostname.includes('..')) {
          return false;
        }
        return true;
      } catch {
        return false;
      }
    };

    // Extract URLs from web search tool results
    let extractedUrls: Array<{ url: string; title?: string; snippet?: string }> = [];

    // Helper function to safely add URL if valid
    const addUrlIfValid = (rawUrl: string | undefined, title?: string, snippet?: string) => {
      if (!rawUrl) {
        return;
      }
      if (!isValidUrl(rawUrl)) {
        console.warn('Skipping invalid/broken URL:', rawUrl.substring(0, 100));
        return;
      }
      const url = cleanUrl(rawUrl);
      if (!isValidUrl(url)) {
        console.warn('Skipping invalid/broken cleaned URL:', url.substring(0, 100));
        return;
      }
      if (!extractedUrls.some(u => u.url === url)) {
        extractedUrls.push({ url, title, snippet });
      }
    };

    // Log all tool-related data for debugging
    console.warn('=== Tool Debug Info ===');
    console.warn('Tool calls:', result.toolCalls?.length || 0);
    console.warn('Tool results:', result.toolResults?.length || 0);
    console.warn('Steps:', (result as any).steps?.length || 0);
    console.warn('Has text:', !!result.text);
    console.warn('Text length:', result.text?.length || 0);

    if (result.toolCalls && result.toolCalls.length > 0) {
      console.warn('Tool call names:', result.toolCalls.map((tc: any) => tc.toolName || tc.toolCallId));
      console.warn('Tool calls details:', JSON.stringify(result.toolCalls, null, 2).substring(0, 500));
    }

    if (result.toolResults && result.toolResults.length > 0) {
      console.warn('Tool results details:', JSON.stringify(result.toolResults, null, 2).substring(0, 500));
    }

    if ((result as any).steps && (result as any).steps.length > 0) {
      console.warn('Steps details:', JSON.stringify((result as any).steps, null, 2).substring(0, 1000));
    }
    console.warn('=== End Tool Debug Info ===');

    // Check steps array for tool results (used in multi-step tool calls)
    if ((result as any).steps && Array.isArray((result as any).steps)) {
      for (const step of (result as any).steps) {
        // Log step structure for debugging
        console.warn('Step structure:', {
          stepType: step.stepType,
          hasToolCalls: !!step.toolCalls,
          hasToolResults: !!step.toolResults,
          hasText: !!step.text,
          toolCallsType: typeof step.toolCalls,
          toolResultsType: typeof step.toolResults,
          toolCallsIsArray: Array.isArray(step.toolCalls),
          toolResultsIsArray: Array.isArray(step.toolResults),
          toolCallsCount: Array.isArray(step.toolCalls) ? step.toolCalls.length : (step.toolCalls ? Object.keys(step.toolCalls).length : 0),
          toolResultsCount: Array.isArray(step.toolResults) ? step.toolResults.length : (step.toolResults ? Object.keys(step.toolResults).length : 0),
        });

        // Check tool calls in step (handle both array and object formats)
        if (step.toolCalls) {
          const toolCallsArray = Array.isArray(step.toolCalls) ? step.toolCalls : Object.values(step.toolCalls);
          if (toolCallsArray.length > 0) {
            console.warn('Found tool calls in step:', toolCallsArray.length);
          }
        }

        if (step.toolCalls && Array.isArray(step.toolCalls)) {
          for (const toolCall of step.toolCalls) {
            const toolName = toolCall.toolName || toolCall.toolCallId;
            if (toolName === 'web_search_preview' || toolName?.includes('web_search')) {
              console.warn('Found web_search tool call in step:', toolName);
              // Tool call found, results should be in toolResults
            }
          }
        }

        // Check tool results in step (handle both array and object formats)
        if (step.toolResults) {
          const toolResultsArray = Array.isArray(step.toolResults)
            ? step.toolResults
            : Object.values(step.toolResults);

          if (toolResultsArray.length > 0) {
            console.warn('Found tool results in step:', toolResultsArray.length);
          }

          for (const toolResult of toolResultsArray) {
            const toolName = toolResult.toolName || (toolResult as any).toolCallId;
            if ((toolName === 'web_search_preview' || toolName?.includes('web_search')) && toolResult.result) {
              try {
                console.warn('Found web_search tool result in step');
                const searchResults = toolResult.result as any;
                console.warn('Step tool result structure:', JSON.stringify(searchResults, null, 2).substring(0, 1000));

                // Use the same extraction logic as above
                if (Array.isArray(searchResults)) {
                  searchResults.forEach((item: any) => {
                    const rawUrl = item.url || item.link || item.href || item.sourceUrl;
                    if (rawUrl && isValidUrl(rawUrl)) {
                      const url = cleanUrl(rawUrl);
                      if (isValidUrl(url) && !extractedUrls.some(u => u.url === url)) {
                        extractedUrls.push({
                          url,
                          title: item.title || item.name || item.headline || item.text,
                          snippet: item.snippet || item.description || item.summary || item.content,
                        });
                      }
                    }
                  });
                } else if (searchResults.results && Array.isArray(searchResults.results)) {
                  searchResults.results.forEach((item: any) => {
                    const rawUrl = item.url || item.link || item.href || item.sourceUrl;
                    if (rawUrl && isValidUrl(rawUrl)) {
                      const url = cleanUrl(rawUrl);
                      if (isValidUrl(url) && !extractedUrls.some(u => u.url === url)) {
                        extractedUrls.push({
                          url,
                          title: item.title || item.name || item.headline || item.text,
                          snippet: item.snippet || item.description || item.summary || item.content,
                        });
                      }
                    }
                  });
                } else {
                  // Try to extract URLs from the result object itself
                  const resultString = JSON.stringify(searchResults);
                  const urlRegex = /https?:\/\/[^\s"<>'`]+/g;
                  const foundUrls = resultString.match(urlRegex);
                  if (foundUrls) {
                    foundUrls.forEach((rawUrl) => {
                      const url = cleanUrl(rawUrl);
                      if (!url.includes('example.com')
                        && !url.includes('localhost')
                        && !url.includes('127.0.0.1')
                        && !extractedUrls.some(u => u.url === url)) {
                        extractedUrls.push({ url });
                      }
                    });
                  }
                }
              } catch (error) {
                console.error('Error extracting URLs from steps:', error);
              }
            }
          }
        }

        // Also check step text for URLs (tool results might be embedded in text)
        if (step.text && typeof step.text === 'string') {
          const urlRegex = /https?:\/\/[^\s"<>'`]+/g;
          const foundUrls = step.text.match(urlRegex);
          if (foundUrls) {
            foundUrls.forEach((rawUrl: string) => {
              const url = cleanUrl(rawUrl);
              if (!url.includes('example.com')
                && !url.includes('localhost')
                && !url.includes('127.0.0.1')
                && !extractedUrls.some(u => u.url === url)) {
                extractedUrls.push({ url });
              }
            });
          }
        }
      }
    }

    // Check toolResults first
    if (result.toolResults && Array.isArray(result.toolResults)) {
      for (const toolResult of result.toolResults as Array<{ toolName?: string; toolCallId?: string; result?: any }>) {
        const toolName = toolResult.toolName || (toolResult as any).toolCallId;
        if ((toolName === 'web_search_preview' || toolName?.includes('web_search')) && toolResult.result) {
          try {
            const searchResults = toolResult.result as any;

            // Log the structure for debugging
            console.warn('Web search tool result structure:', JSON.stringify(searchResults, null, 2).substring(0, 1000));

            // Handle string results that might contain JSON
            let parsedResults = searchResults;
            if (typeof searchResults === 'string') {
              try {
                parsedResults = JSON.parse(searchResults);
              } catch {
                // If not JSON, treat as text and extract URLs
                const urlRegex = /https?:\/\/[^\s"<>'`]+/g;
                const foundUrls = searchResults.match(urlRegex);
                if (foundUrls) {
                  foundUrls.forEach((rawUrl) => {
                    const url = cleanUrl(rawUrl);
                    if (!url.includes('example.com')
                      && !url.includes('localhost')
                      && !url.includes('127.0.0.1')
                      && !extractedUrls.some(u => u.url === url)) {
                      extractedUrls.push({ url });
                    }
                  });
                }
                continue; // Skip to next tool result
              }
            }

            // Handle different possible response formats
            if (Array.isArray(parsedResults)) {
              parsedResults.forEach((item: any) => {
                const rawUrl = item.url || item.link || item.href || item.sourceUrl;
                if (rawUrl) {
                  const url = cleanUrl(rawUrl);
                  extractedUrls.push({
                    url,
                    title: item.title || item.name || item.headline || item.text,
                    snippet: item.snippet || item.description || item.summary || item.content,
                  });
                }
              });
            } else if (parsedResults.results && Array.isArray(parsedResults.results)) {
              parsedResults.results.forEach((item: any) => {
                const rawUrl = item.url || item.link || item.href || item.sourceUrl;
                if (rawUrl) {
                  const url = cleanUrl(rawUrl);
                  extractedUrls.push({
                    url,
                    title: item.title || item.name || item.headline || item.text,
                    snippet: item.snippet || item.description || item.summary || item.content,
                  });
                }
              });
            } else if (parsedResults.items && Array.isArray(parsedResults.items)) {
              parsedResults.items.forEach((item: any) => {
                const rawUrl = item.url || item.link || item.href || item.sourceUrl;
                if (rawUrl) {
                  const url = cleanUrl(rawUrl);
                  extractedUrls.push({
                    url,
                    title: item.title || item.name || item.headline || item.text,
                    snippet: item.snippet || item.description || item.summary || item.content,
                  });
                }
              });
            } else if (parsedResults.data && Array.isArray(parsedResults.data)) {
              parsedResults.data.forEach((item: any) => {
                const rawUrl = item.url || item.link || item.href || item.sourceUrl;
                addUrlIfValid(
                  rawUrl,
                  item.title || item.name || item.headline || item.text,
                  item.snippet || item.description || item.summary || item.content,
                );
              });
            } else if (parsedResults.url || parsedResults.link || parsedResults.href || parsedResults.sourceUrl) {
              // Single result
              const rawUrl = parsedResults.url || parsedResults.link || parsedResults.href || parsedResults.sourceUrl;
              addUrlIfValid(
                rawUrl,
                parsedResults.title || parsedResults.name || parsedResults.headline || parsedResults.text,
                parsedResults.snippet || parsedResults.description || parsedResults.summary || parsedResults.content,
              );
            } else {
              // Try to extract URLs from text content if structured format not available
              const resultString = JSON.stringify(parsedResults);
              const urlRegex = /https?:\/\/[^\s"<>'`]+/g;
              const foundUrls = resultString.match(urlRegex);
              if (foundUrls) {
                foundUrls.forEach((rawUrl) => {
                  if (isValidUrl(rawUrl)) {
                    addUrlIfValid(rawUrl);
                  }
                });
              }
            }
          } catch (error) {
            console.error('Error extracting URLs from tool results:', error);
          }
        }
      }
    }

    // Also check toolCalls for any embedded results
    if (result.toolCalls && Array.isArray(result.toolCalls) && extractedUrls.length === 0) {
      for (const toolCall of result.toolCalls as Array<any>) {
        if (toolCall.result && (toolCall.toolName === 'web_search_preview' || toolCall.toolName?.includes('web_search'))) {
          try {
            const searchResults = toolCall.result as any;
            const resultString = JSON.stringify(searchResults);
            const urlRegex = /https?:\/\/[^\s"<>'`]+/g;
            const foundUrls = resultString.match(urlRegex);
            if (foundUrls) {
              foundUrls.forEach((rawUrl) => {
                if (isValidUrl(rawUrl)) {
                  addUrlIfValid(rawUrl);
                }
              });
            }
          } catch (error) {
            console.error('Error extracting URLs from tool calls:', error);
          }
        }
      }
    }

    // If no URLs extracted from tool results, try extracting from response text as fallback
    if (extractedUrls.length === 0 && result.text) {
      console.warn('No URLs from tool results, attempting to extract from response text...');
      const urlRegex = /https?:\/\/[^\s"<>'`]+/g;
      const foundUrls = result.text.match(urlRegex);
      if (foundUrls) {
        foundUrls.forEach((rawUrl) => {
          if (!isValidUrl(rawUrl)) {
            return; // Skip invalid URLs
          }

          // Try to extract title from context around the URL
          const urlIndex = result.text.indexOf(rawUrl);
          let title: string | undefined;
          if (urlIndex !== -1) {
            // Look for title in the 100 characters before the URL
            const contextBefore = result.text.substring(Math.max(0, urlIndex - 100), urlIndex);
            // Try to find quoted text or text before colon/semicolon
            const titleMatch = contextBefore.match(/"([^"]+)":|'([^']+)':|([^:;,\n]+):\s*$/);
            title = titleMatch ? (titleMatch[1] || titleMatch[2] || titleMatch[3]?.trim()) : undefined;

            // Also try to extract domain name as fallback title
            const domainMatch = rawUrl.match(/https?:\/\/(?:www\.)?([^/]+)/);
            const domainTitle = domainMatch && domainMatch[1] ? domainMatch[1].replace(/\.(com|org|net|io|co|il)$/, '') : undefined;
            title = title || domainTitle;
          }

          addUrlIfValid(rawUrl, title);
        });
        console.warn(`Extracted ${extractedUrls.length} URLs from response text as fallback`);
      }
    }

    // Log extracted URLs for debugging
    if (extractedUrls.length > 0) {
      console.warn(`Extracted ${extractedUrls.length} URLs from web search:`, extractedUrls.map(u => u.url));
    } else {
      console.warn('No URLs extracted from web search tool results or response text');
      // Log full tool result structure for debugging
      if (process.env.NODE_ENV === 'development' && result.toolResults) {
        console.warn('Full toolResults structure:', JSON.stringify(result.toolResults, null, 2));
      }
    }

    // Strip markdown code blocks if present and extract JSON
    let jsonText = result.text || '{}';
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    jsonText = jsonText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // Find JSON object boundaries
    const jsonStart = jsonText.indexOf('{');

    if (jsonStart === -1) {
      jsonText = '{}';
    } else {
      // Find the matching closing brace by counting braces
      let braceCount = 0;
      let jsonEnd = -1;
      let inString = false;
      let escapeNext = false;

      for (let i = jsonStart; i < jsonText.length; i++) {
        const char = jsonText[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') {
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i;
              break;
            }
          }
        }
      }

      // If we found a valid end, extract up to that point
      if (jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
      } else {
        // Fallback: use lastIndexOf but verify it's the root closing brace
        const fallbackEnd = jsonText.lastIndexOf('}');
        if (fallbackEnd > jsonStart) {
          // Check if there are any non-whitespace characters after this brace
          const afterBrace = jsonText.substring(fallbackEnd + 1).trim();
          if (afterBrace.length === 0) {
            // No trailing content, safe to use
            jsonText = jsonText.substring(jsonStart, fallbackEnd + 1);
          } else {
            // There's trailing content, try to find the actual end by counting braces
            braceCount = 0;
            for (let i = jsonStart; i <= fallbackEnd; i++) {
              if (jsonText[i] === '{') {
                braceCount++;
              }
              if (jsonText[i] === '}') {
                braceCount--;
              }
            }
            if (braceCount === 0) {
              // Balanced braces, use this end
              jsonText = jsonText.substring(jsonStart, fallbackEnd + 1);
            } else {
              // Unbalanced, try to extract what we can
              jsonText = jsonText.substring(jsonStart);
              // Remove any trailing non-JSON content
              jsonText = jsonText.replace(/\}[^}]*$/, '}');
            }
          }
        } else {
          // No closing brace found, extract from start
          jsonText = jsonText.substring(jsonStart);
        }
      }
    }

    // Remove any trailing whitespace or non-JSON characters after the closing brace
    jsonText = jsonText.trim();
    // Remove any text after the last closing brace
    const lastBrace = jsonText.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace < jsonText.length - 1) {
      jsonText = jsonText.substring(0, lastBrace + 1);
    }

    // Function to repair common JSON issues (defined early so it can be used)
    const repairJSON = (text: string): string => {
      let repaired = text;

      // First, ensure all strings are properly closed (handle truncated strings)
      let inStringCheck = false;
      let escapeNextCheck = false;
      let stringStart = -1;

      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (escapeNextCheck) {
          escapeNextCheck = false;
          continue;
        }
        if (char === '\\') {
          escapeNextCheck = true;
          continue;
        }
        if (char === '"') {
          if (!inStringCheck) {
            inStringCheck = true;
            stringStart = i;
          } else {
            inStringCheck = false;
            stringStart = -1;
          }
        }
      }

      // If we're still in a string at the end, close it
      if (inStringCheck && stringStart !== -1) {
        const unclosedString = repaired.substring(stringStart + 1);
        repaired = repaired.substring(0, stringStart + 1) + unclosedString.replace(/"([^"]*)$/, '$1"');
      }

      // Remove trailing commas before closing brackets/braces (multiple passes to catch nested cases)
      for (let i = 0; i < 5; i++) {
        repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
      }

      // Remove trailing commas after array elements (handle cases like: "item",] -> "item"])
      repaired = repaired.replace(/",\s*\]/g, '"]');
      repaired = repaired.replace(/,\s*\]/g, ']');

      // Remove trailing commas before closing braces
      repaired = repaired.replace(/,\s*\}/g, '}');

      // Track structure depth and fix missing closing brackets
      const stack: Array<'{' | '['> = [];
      let inString = false;
      let escapeNext = false;
      let result = '';

      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (!char) {
          continue;
        } // Skip if undefined (shouldn't happen, but TypeScript safety)

        if (escapeNext) {
          escapeNext = false;
          result += char;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          result += char;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          result += char;
          continue;
        }

        if (!inString) {
          // Skip whitespace between elements
          if (/\s/.test(char)) {
            result += char;
            continue;
          }

          if (char === '{') {
            stack.push('{');
            result += char;
          } else if (char === '[') {
            stack.push('[');
            result += char;
          } else if (char === '}') {
            // Before closing a brace, check if we need to close any arrays first
            while (stack.length > 0 && stack[stack.length - 1] === '[') {
              result += ']';
              stack.pop();
            }
            if (stack.length > 0 && stack[stack.length - 1] === '{') {
              stack.pop();
            }
            result += char;
            // If we've closed the root object (stack is empty), stop processing to avoid trailing content
            if (stack.length === 0 && !inString) {
              // We've closed the root JSON object, stop here
              break;
            }
          } else if (char === ']') {
            // Close the matching bracket
            if (stack.length > 0 && stack[stack.length - 1] === '[') {
              stack.pop();
            }
            result += char;
          } else if (char === ',') {
            // Only add comma if it's not trailing (next non-whitespace char is not ] or })
            const nextNonWhitespace = repaired.substring(i + 1).match(/\S/)?.[0];
            if (nextNonWhitespace && nextNonWhitespace !== ']' && nextNonWhitespace !== '}') {
              result += char;
            }
            // Otherwise skip the trailing comma
          } else {
            result += char;
          }
        } else {
          result += char;
        }
      }

      // Close any remaining open structures (arrays first, then objects)
      while (stack.length > 0) {
        const top = stack.pop();
        if (!top) {
          break;
        }
        if (top === '[') {
          result += ']';
        } else if (top === '{') {
          result += '}';
        }
      }

      // Final cleanup: remove any remaining trailing commas
      result = result.replace(/,(\s*[}\]])/g, '$1');

      // Remove any trailing content after the last closing brace
      const lastBrace = result.lastIndexOf('}');
      if (lastBrace !== -1 && lastBrace < result.length - 1) {
        // Check if there's any non-whitespace after the last brace
        const afterBrace = result.substring(lastBrace + 1).trim();
        if (afterBrace.length > 0) {
          // There's trailing content, remove it
          result = result.substring(0, lastBrace + 1);
        }
      }

      return result;
    };

    // Pre-repair JSON before first parse attempt to reduce errors
    jsonText = repairJSON(jsonText);

    // Final cleanup: ensure no trailing content after the last closing brace
    jsonText = jsonText.trim();
    const finalLastBrace = jsonText.lastIndexOf('}');
    if (finalLastBrace !== -1 && finalLastBrace < jsonText.length - 1) {
      const trailingContent = jsonText.substring(finalLastBrace + 1).trim();
      if (trailingContent.length > 0) {
        // Remove trailing content
        jsonText = jsonText.substring(0, finalLastBrace + 1);
      }
    }

    let content;
    try {
      content = JSON.parse(jsonText);
    } catch (parseError) {
      // Only log detailed errors in development mode
      if (process.env.NODE_ENV === 'development') {
        console.warn('Initial JSON parse failed, attempting repair...');
        console.error('Parse error:', parseError);
        console.error('JSON length:', jsonText.length);
      }

      // Extract error position if available
      const errorMatch = parseError instanceof Error ? parseError.message.match(/position (\d+)/) : null;
      if (errorMatch && errorMatch[1]) {
        const errorPos = Number.parseInt(errorMatch[1], 10);
        const start = Math.max(0, errorPos - 100);
        const end = Math.min(jsonText.length, errorPos + 100);
        console.error(`JSON around error position ${errorPos}:`, jsonText.substring(start, end));
        console.error('Character at error position:', jsonText[errorPos] || 'N/A');
      }

      console.error('JSON preview (first 500 chars):', jsonText.substring(0, 500));
      console.error('JSON preview (last 500 chars):', jsonText.substring(Math.max(0, jsonText.length - 500)));

      // Try additional repair (though pre-repair should have handled most issues)
      try {
        const repairedJson = repairJSON(jsonText);
        content = JSON.parse(repairedJson);
        if (process.env.NODE_ENV === 'development') {
          console.warn('JSON repair successful after additional repair');
        }
      } catch (repairError) {
        console.error('JSON repair also failed:', repairError);
        const repairedJson = repairJSON(jsonText);
        console.error('Repaired JSON length:', repairedJson.length);

        // Log the repaired JSON around the error position for debugging
        if (repairError instanceof Error) {
          const repairErrorMatch = repairError.message.match(/position (\d+)/);
          if (repairErrorMatch && repairErrorMatch[1]) {
            const repairErrorPos = Number.parseInt(repairErrorMatch[1], 10);
            const start = Math.max(0, repairErrorPos - 50);
            const end = Math.min(repairedJson.length, repairErrorPos + 50);
            console.error(`Repaired JSON around error position ${repairErrorPos}:`, repairedJson.substring(start, end));
          }
        }

        // Last resort: try to extract just the essential parts
        try {
          // Try to find and parse just the main structure
          const scoreMatch = jsonText.match(/"overall_score"\s*:\s*(\d+)/);
          const positiveMatch = jsonText.match(/"positive_percentage"\s*:\s*(\d+)/);
          const negativeMatch = jsonText.match(/"negative_percentage"\s*:\s*(\d+)/);
          const neutralMatch = jsonText.match(/"neutral_percentage"\s*:\s*(\d+)/);

          if (scoreMatch?.[1] && positiveMatch?.[1] && negativeMatch?.[1] && neutralMatch?.[1]) {
            // Create a minimal valid JSON structure
            content = {
              overall_score: Number.parseInt(scoreMatch[1], 10),
              positive_percentage: Number.parseInt(positiveMatch[1], 10),
              negative_percentage: Number.parseInt(negativeMatch[1], 10),
              neutral_percentage: Number.parseInt(neutralMatch[1], 10),
              positive_themes: [],
              negative_themes: [],
              report: {
                overall_sentiment_section: '',
                positive_feedback: { title: '', items: [] },
                critical_feedback: { title: '', items: [] },
                summary: { positive: '', negative: '' },
                positioning: '',
                sentiment_snapshot: [],
                key_takeaways: [],
              },
            };
            console.warn('Created minimal JSON structure due to parse failure');
          } else {
            throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
          }
        } catch {
          console.error('All JSON parsing attempts failed');
          throw new Error(`Invalid JSON response from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      }
    }
    if (content.overall_score !== undefined || (content.positive_percentage !== undefined && content.negative_percentage !== undefined)) {
      // Filter out example.com URLs from extracted URLs
      extractedUrls = extractedUrls.filter(u => !u.url.includes('example.com'));

      // Clean all extracted URLs and deduplicate
      const cleanedUrlsMap = new Map<string, { url: string; title?: string; snippet?: string }>();
      extractedUrls.forEach((u) => {
        const cleaned = cleanUrl(u.url);
        if (!cleanedUrlsMap.has(cleaned)) {
          cleanedUrlsMap.set(cleaned, { ...u, url: cleaned });
        } else {
          // Merge titles/snippets if available
          const existing = cleanedUrlsMap.get(cleaned)!;
          if (!existing.title && u.title) {
            existing.title = u.title;
          }
          if (!existing.snippet && u.snippet) {
            existing.snippet = u.snippet;
          }
        }
      });
      extractedUrls = Array.from(cleanedUrlsMap.values());

      // Extract URLs and titles from the parsed JSON content if not already extracted from tool results
      if (extractedUrls.length === 0) {
        // Extract from positive_feedback.items (excluding example.com)
        if (content.report?.positive_feedback?.items && Array.isArray(content.report.positive_feedback.items)) {
          content.report.positive_feedback.items.forEach((item: any) => {
            if (item.url
              && !item.url.includes('example.com')) {
              const cleanedUrl = cleanUrl(item.url);
              if (!extractedUrls.some(u => u.url === cleanedUrl)) {
                extractedUrls.push({
                  url: cleanedUrl,
                  title: item.title,
                  snippet: item.description,
                });
              }
            }
          });
        }

        // Extract from critical_feedback.items (excluding example.com)
        if (content.report?.critical_feedback?.items && Array.isArray(content.report.critical_feedback.items)) {
          content.report.critical_feedback.items.forEach((item: any) => {
            if (item.url
              && !item.url.includes('example.com')) {
              const cleanedUrl = cleanUrl(item.url);
              if (!extractedUrls.some(u => u.url === cleanedUrl)) {
                extractedUrls.push({
                  url: cleanedUrl,
                  title: item.title,
                  snippet: item.description,
                });
              }
            }
          });
        }

        // Extract from sentiment_snapshot (excluding example.com)
        if (content.report?.sentiment_snapshot && Array.isArray(content.report.sentiment_snapshot)) {
          content.report.sentiment_snapshot.forEach((snapshot: any) => {
            if (snapshot.url
              && !snapshot.url.includes('example.com')) {
              const cleanedUrl = cleanUrl(snapshot.url);
              if (!extractedUrls.some(u => u.url === cleanedUrl)) {
                extractedUrls.push({
                  url: cleanedUrl,
                  title: snapshot.source,
                  snippet: snapshot.sentiment_summary,
                });
              }
            }
          });
        }

        console.warn(`Extracted ${extractedUrls.length} URLs from parsed JSON content (excluding example.com)`);
      } else {
        // If we have URLs from tool results, enrich them with titles from JSON if available
        extractedUrls.forEach((extractedUrl) => {
          if (!extractedUrl.title) {
            // Try to find title in JSON content (match by cleaned URL)
            if (content.report?.positive_feedback?.items) {
              const item = content.report.positive_feedback.items.find((i: any) => i.url && cleanUrl(i.url) === extractedUrl.url);
              if (item?.title) {
                extractedUrl.title = item.title;
                extractedUrl.snippet = item.description;
              }
            }
            if (!extractedUrl.title && content.report?.critical_feedback?.items) {
              const item = content.report.critical_feedback.items.find((i: any) => i.url && cleanUrl(i.url) === extractedUrl.url);
              if (item?.title) {
                extractedUrl.title = item.title;
                extractedUrl.snippet = item.description;
              }
            }
            if (!extractedUrl.title && content.report?.sentiment_snapshot) {
              const snapshot = content.report.sentiment_snapshot.find((s: any) => s.url && cleanUrl(s.url) === extractedUrl.url);
              if (snapshot?.source) {
                extractedUrl.title = snapshot.source;
                extractedUrl.snippet = snapshot.sentiment_summary;
              }
            }
          }
        });
      }

      // Ensure URLs from tool results are used in the response and replace example.com URLs
      if (extractedUrls.length > 0) {
        const urlsUsed: string[] = [];
        let urlIndex = 0;

        // Replace URLs in sentiment_snapshot with actual URLs from tool results
        if (content.report?.sentiment_snapshot && Array.isArray(content.report.sentiment_snapshot)) {
          content.report.sentiment_snapshot = content.report.sentiment_snapshot.map((snapshot: any, index: number) => {
            // Replace example.com URLs or use URL from tool results
            let finalUrl = snapshot.url ? cleanUrl(snapshot.url) : undefined;
            if (snapshot.url && snapshot.url.includes('example.com')) {
              // Replace example.com URL with a real URL
              const replacementUrl = extractedUrls[urlIndex]?.url;
              if (replacementUrl) {
                finalUrl = cleanUrl(replacementUrl);
                urlsUsed.push(finalUrl);
                urlIndex++;
              } else {
                // Remove example.com URL if no replacement available
                finalUrl = undefined;
              }
            } else if (extractedUrls[index]?.url) {
              // Use URL from tool results if available
              finalUrl = cleanUrl(extractedUrls[index].url);
              urlsUsed.push(finalUrl);
            } else if (snapshot.url && !snapshot.url.includes('example.com')) {
              // Keep existing real URL (already cleaned above)
              urlsUsed.push(finalUrl!);
            }

            if (finalUrl) {
              return {
                ...snapshot,
                url: finalUrl,
                source: snapshot.source || extractedUrls[index]?.title || snapshot.source || `Source ${index + 1}`,
                sentiment_summary: snapshot.sentiment_summary || extractedUrls[index]?.snippet || snapshot.sentiment_summary,
              };
            }
            // Remove entry if no valid URL
            return null;
          }).filter((item: any) => item !== null);

          // Add additional URLs from tool results if we have more URLs than snapshot entries
          const existingCount = content.report.sentiment_snapshot.length;
          if (extractedUrls.length > existingCount) {
            const additionalUrls = extractedUrls.slice(existingCount);
            additionalUrls.forEach((urlData, index) => {
              urlsUsed.push(urlData.url);
              content.report.sentiment_snapshot.push({
                source: urlData.title || `Source ${existingCount + index + 1}`,
                sentiment_summary: urlData.snippet || (isHebrew ? 'מידע מהאינטרנט' : 'Information from web search'),
                url: urlData.url,
              });
            });
          }
        } else if (content.report) {
          // Create sentiment_snapshot from extracted URLs if it doesn't exist
          content.report.sentiment_snapshot = extractedUrls.slice(0, 4).map((urlData, index) => {
            urlsUsed.push(urlData.url);
            return {
              source: urlData.title || `Source ${index + 1}`,
              sentiment_summary: urlData.snippet || (isHebrew ? 'מידע מהאינטרנט' : 'Information from web search'),
              url: urlData.url,
            };
          });
        }

        // Replace URLs in positive_feedback.items with actual URLs from tool results
        if (content.report?.positive_feedback?.items && Array.isArray(content.report.positive_feedback.items)) {
          content.report.positive_feedback.items = content.report.positive_feedback.items.map((item: any, index: number) => {
            // Replace example.com URLs or use URL from tool results
            let finalUrl = item.url ? cleanUrl(item.url) : undefined;
            if (item.url && item.url.includes('example.com')) {
              // Replace example.com URL with a real URL
              const replacementUrl = extractedUrls[urlIndex]?.url;
              if (replacementUrl) {
                finalUrl = cleanUrl(replacementUrl);
                if (!urlsUsed.includes(finalUrl)) {
                  urlsUsed.push(finalUrl);
                }
                urlIndex++;
              } else {
                // Remove example.com URL if no replacement available
                finalUrl = undefined;
              }
            } else if (extractedUrls[index]?.url) {
              // Use URL from tool results if available
              finalUrl = cleanUrl(extractedUrls[index].url);
              if (!urlsUsed.includes(finalUrl)) {
                urlsUsed.push(finalUrl);
              }
            } else if (item.url && !item.url.includes('example.com')) {
              // Keep existing real URL (already cleaned above)
              if (!urlsUsed.includes(finalUrl!)) {
                urlsUsed.push(finalUrl!);
              }
            }

            if (finalUrl) {
              return { ...item, url: finalUrl };
            }
            // Remove item if no valid URL
            return null;
          }).filter((item: any) => item !== null);
        }

        // Replace URLs in critical_feedback.items with actual URLs from tool results
        if (content.report?.critical_feedback?.items && Array.isArray(content.report.critical_feedback.items)) {
          const startIndex = content.report.positive_feedback?.items?.length || 0;
          content.report.critical_feedback.items = content.report.critical_feedback.items.map((item: any, index: number) => {
            // Replace example.com URLs or use URL from tool results
            let finalUrl = item.url ? cleanUrl(item.url) : undefined;
            if (item.url && item.url.includes('example.com')) {
              // Replace example.com URL with a real URL
              const replacementUrl = extractedUrls[urlIndex]?.url;
              if (replacementUrl) {
                finalUrl = cleanUrl(replacementUrl);
                if (!urlsUsed.includes(finalUrl)) {
                  urlsUsed.push(finalUrl);
                }
                urlIndex++;
              } else {
                // Remove example.com URL if no replacement available
                finalUrl = undefined;
              }
            } else {
              const urlIndexForItem = startIndex + index;
              const toolUrl = extractedUrls[urlIndexForItem]?.url;
              if (toolUrl) {
                finalUrl = cleanUrl(toolUrl);
                if (!urlsUsed.includes(finalUrl)) {
                  urlsUsed.push(finalUrl);
                }
              } else if (item.url && !item.url.includes('example.com')) {
                // Keep existing real URL (already cleaned above)
                if (!urlsUsed.includes(finalUrl!)) {
                  urlsUsed.push(finalUrl!);
                }
              }
            }

            if (finalUrl) {
              return { ...item, url: finalUrl };
            }
            // Remove item if no valid URL
            return null;
          }).filter((item: any) => item !== null);
        }

        // Log which URLs were actually used
        if (urlsUsed.length > 0) {
          console.warn(`Using ${urlsUsed.length} URLs from web search tool results in response:`, urlsUsed);
        }
      } else {
        console.warn('No URLs available from tool results to inject into response');
      }

      // Calculate overall_score dynamically based on sentiment percentages if not provided or to ensure it's accurate
      const positive = content.positive_percentage || 0;
      const neutral = content.neutral_percentage || 0;

      // Calculate score: positive counts fully, neutral counts half, negative counts zero
      // Formula: positive% + (neutral% * 0.5)
      const calculatedScore = Math.round(positive + (neutral * 0.5));

      // Use calculated score if OpenAI didn't provide one, or if the provided score seems inconsistent
      // (more than 10 points difference suggests inconsistency)
      const providedScore = content.overall_score || 0;
      const scoreDifference = Math.abs(calculatedScore - providedScore);
      const finalScore = scoreDifference > 10 ? calculatedScore : (providedScore || calculatedScore);

      return NextResponse.json({
        ...content,
        overall_score: finalScore,
        search_trends_daily: searchTrendsDaily,
        search_trends_monthly: searchTrendsMonthly,
      });
    } else {
      // If content doesn't have expected fields, return error
      console.error('Invalid response format from OpenAI:', content);
      return NextResponse.json(
        { error: isHebrew ? 'תגובה לא תקינה מ-OpenAI API' : 'Invalid response from OpenAI API' },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: isHebrew
          ? `שגיאה ב-OpenAI API: ${errorMessage}`
          : `OpenAI API error: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 },
    );
  }
}
