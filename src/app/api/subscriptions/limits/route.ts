import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { createGetlateClient } from '@/libs/Getlate';
import { getSubscriptionPlan, getUserSubscription } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { brands, socialAccounts } from '@/models/Schema';

/**
 * Get user's subscription limits, current usage, and feature flags
 * Query params:
 * - brandId (optional): Filter posts count and social accounts count by brand
 */
export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get optional brandId from query params
    const url = new URL(request.url);
    const brandId = url.searchParams.get('brandId');

    const subscription = await getUserSubscription(user.id);

    let limits: {
      maxPostsPerMonth: number;
      maxAIGenerationsPerMonth: number;
      maxImageGenerationsPerMonth: number; // Separate limit for image generation, equals AI content limit
      maxImagesPerPost: number;
      maxBrands: number;
      maxSocialAccounts: number;
      planType: 'free' | 'basic' | 'pro' | 'business';
    } = {
      maxPostsPerMonth: 10,
      maxAIGenerationsPerMonth: 5,
      maxImageGenerationsPerMonth: 5, // Same as AI content limit
      maxImagesPerPost: 3,
      maxBrands: 1,
      maxSocialAccounts: 3,
      planType: 'free',
    };

    let features = {
      pdfPptReports: false,
      semanticAnalysis: false,
      brandSentiment: false,
      preferredSupport: false,
    };

    if (subscription && subscription.planType !== 'free') {
      const now = new Date();
      const isSubscriptionActive = subscription.status === 'active' || subscription.status === 'trialing';
      const isNotExpired = !subscription.endDate || new Date(subscription.endDate) > now;

      if (isSubscriptionActive && isNotExpired) {
        const plan = await getSubscriptionPlan(subscription.planType as 'basic' | 'pro' | 'business');

        if (plan) {
          const maxAIGenerations = (plan.features as any)?.max_ai_generations_per_month
            || (subscription.planType === 'basic'
              ? 50
              : subscription.planType === 'pro' ? 500 : 2500);

          limits = {
            maxPostsPerMonth: plan.maxPostsPerMonth || 999999, // Unlimited if null
            maxAIGenerationsPerMonth: maxAIGenerations,
            maxImageGenerationsPerMonth: maxAIGenerations, // Same as AI content limit
            maxImagesPerPost: (plan.features as any)?.max_images_per_post
              || (subscription.planType === 'basic'
                ? 5
                : subscription.planType === 'pro' ? 10 : 20),
            maxBrands: plan.maxBrands || 999999, // Unlimited if null
            maxSocialAccounts: plan.maxSocialAccounts || 999999, // Unlimited if null
            planType: subscription.planType as 'basic' | 'pro' | 'business' | 'free',
          };

          // Set feature flags based on plan
          const planFeatures = (plan.features as any) || {};
          const featureKeys = Array.isArray(planFeatures) ? planFeatures : Object.keys(planFeatures);

          // Pro and Business plans have these features
          if (subscription.planType === 'pro' || subscription.planType === 'business') {
            features = {
              pdfPptReports: featureKeys.includes('pdf_ppt_reports') || true,
              semanticAnalysis: featureKeys.includes('semantic_analysis') || true,
              brandSentiment: featureKeys.includes('brand_sentiment') || true,
              preferredSupport: featureKeys.includes('preferred_support') || true,
            };
          }
        } else {
          // Fallback if plan not found - use hardcoded defaults
          const maxAIGenerations = subscription.planType === 'basic' ? 50 : subscription.planType === 'pro' ? 500 : 2500;

          limits = {
            maxPostsPerMonth: subscription.planType === 'basic' ? 30 : subscription.planType === 'pro' ? 300 : 1500,
            maxAIGenerationsPerMonth: maxAIGenerations,
            maxImageGenerationsPerMonth: maxAIGenerations, // Same as AI content limit
            maxImagesPerPost: subscription.planType === 'basic' ? 5 : subscription.planType === 'pro' ? 10 : 20,
            maxBrands: subscription.planType === 'basic' ? 1 : subscription.planType === 'pro' ? 10 : 50,
            maxSocialAccounts: subscription.planType === 'basic' ? 7 : subscription.planType === 'pro' ? 70 : 350,
            planType: subscription.planType as 'basic' | 'pro' | 'business',
          };

          if (subscription.planType === 'pro' || subscription.planType === 'business') {
            features = {
              pdfPptReports: true,
              semanticAnalysis: true,
              brandSentiment: true,
              preferredSupport: true,
            };
          }
        }
      }
    }

    // Get current usage from user_usage table for AI generations
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const currentYear = new Date().getFullYear();

    const { data: usageRecord } = await supabase
      .from('user_usage')
      .select('ai_content_generations, ai_image_generations, posts_created')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle();

    // Count posts from posts table (source of truth for posts created this month)
    // Filter by brand if brandId is provided (for brand-specific post counts)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    let postsQuery = supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());

    // Filter by brand if brandId is provided
    // This allows showing posts count per brand instead of total user posts
    if (brandId) {
      // Validate that the brand belongs to the user (security check)
      const { data: brandCheck } = await supabase
        .from('brands')
        .select('id')
        .eq('id', brandId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (brandCheck) {
        postsQuery = postsQuery.eq('brand_id', brandId);
      }
      // If brand doesn't belong to user, ignore brandId and count all posts
    }

    const { count: postsCountFromTable } = await postsQuery;

    // Use posts count from posts table (source of truth)
    // Use AI generation counts from user_usage table (more efficient)
    const postsCount = postsCountFromTable || 0;
    const aiContentCount = usageRecord?.ai_content_generations || 0;
    const aiImageCount = usageRecord?.ai_image_generations || 0;

    const brandsCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brands)
      .where(eq(brands.userId, user.id));

    const brandsCount = brandsCountResult[0]?.count || 0;

    // Count social accounts from Getlate API by profile (brand) - per brand if brandId is provided
    let socialAccountsCount = 0;

    if (brandId) {
      // Validate that the brand belongs to the user and get Getlate profile ID via Supabase
      const { data: brandRecord } = await supabase
        .from('brands')
        .select('id, getlate_profile_id')
        .eq('id', brandId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (brandRecord?.getlate_profile_id) {
        // Brand belongs to user and has Getlate profile, fetch accounts from Getlate API
        try {
          // Get user's Getlate API key
          const { data: userRecord } = await supabase
            .from('users')
            .select('getlate_api_key')
            .eq('id', user.id)
            .maybeSingle();

          if (userRecord?.getlate_api_key) {
            const getlateClient = createGetlateClient(userRecord.getlate_api_key);
            const getlateAccounts = await getlateClient.getAccounts(brandRecord.getlate_profile_id);

            // Count active/connected accounts from Getlate API
            // Filter to only count connected accounts (isConnected or isActive)
            socialAccountsCount = getlateAccounts.filter(account =>
              account.isConnected !== false && account.isActive !== false,
            ).length;
          } else {
            // Fallback to database count if no Getlate API key
            const socialAccountsCountResult = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(socialAccounts)
              .where(and(
                eq(socialAccounts.userId, user.id),
                eq(socialAccounts.brandId, brandId),
              ));
            socialAccountsCount = socialAccountsCountResult[0]?.count || 0;
          }
        } catch (error) {
          console.error('Error fetching accounts from Getlate API:', error);
          // Fallback to database count on error
          const socialAccountsCountResult = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(socialAccounts)
            .where(and(
              eq(socialAccounts.userId, user.id),
              eq(socialAccounts.brandId, brandId),
            ));
          socialAccountsCount = socialAccountsCountResult[0]?.count || 0;
        }
      } else if (brandRecord) {
        // Brand belongs to user but no Getlate profile, count from database
        const socialAccountsCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(socialAccounts)
          .where(and(
            eq(socialAccounts.userId, user.id),
            eq(socialAccounts.brandId, brandId),
          ));
        socialAccountsCount = socialAccountsCountResult[0]?.count || 0;
      } else {
        // If brand doesn't belong to user, ignore brandId and count all accounts from database
        const socialAccountsCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(socialAccounts)
          .where(eq(socialAccounts.userId, user.id));
        socialAccountsCount = socialAccountsCountResult[0]?.count || 0;
      }
    } else {
      // No brandId provided, count all user accounts from database
      // Note: This counts across all brands, which is the fallback behavior
      const socialAccountsCountResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(socialAccounts)
        .where(eq(socialAccounts.userId, user.id));
      socialAccountsCount = socialAccountsCountResult[0]?.count || 0;
    }

    const usage = {
      postsThisMonth: postsCount || 0,
      aiGenerationsThisMonth: aiContentCount || 0,
      aiImageGenerationsThisMonth: aiImageCount || 0, // AI image generations from user_usage table
      imagesInCurrentPost: 0, // Will be set by client
      brandsCount,
      socialAccountsCount,
    };

    return NextResponse.json({
      limits,
      usage,
      features,
      canCreatePost: (usage.postsThisMonth || 0) < limits.maxPostsPerMonth,
      canGenerateAI: (usage.aiGenerationsThisMonth || 0) < limits.maxAIGenerationsPerMonth,
      canCreateBrand: (usage.brandsCount || 0) < limits.maxBrands,
      canConnectAccount: (usage.socialAccountsCount || 0) < limits.maxSocialAccounts,
      canGenerateImage: aiImageCount < limits.maxImageGenerationsPerMonth, // Separate check for image generation
    });
  } catch (error: any) {
    console.error('Error getting subscription limits:', error);
    return NextResponse.json({ error: 'Failed to get subscription limits' }, { status: 500 });
  }
}
