import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/libs/DB';
import { getSubscriptionPlan, getUserSubscription } from '@/libs/subscriptionService';
import { createSupabaseServerClient } from '@/libs/Supabase';
import { brands, socialAccounts } from '@/models/Schema';

/**
 * Get user's subscription limits, current usage, and feature flags
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscription = await getUserSubscription(user.id);

    let limits: {
      maxPostsPerMonth: number;
      maxAIGenerationsPerMonth: number;
      maxImagesPerPost: number;
      maxBrands: number;
      maxSocialAccounts: number;
      planType: 'free' | 'basic' | 'pro' | 'business';
    } = {
      maxPostsPerMonth: 10,
      maxAIGenerationsPerMonth: 5,
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
          limits = {
            maxPostsPerMonth: plan.maxPostsPerMonth || 999999, // Unlimited if null
            maxAIGenerationsPerMonth: (plan.features as any)?.max_ai_generations_per_month
              || (subscription.planType === 'basic'
                ? 50
                : subscription.planType === 'pro' ? 500 : 2500),
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
          limits = {
            maxPostsPerMonth: subscription.planType === 'basic' ? 30 : subscription.planType === 'pro' ? 300 : 1500,
            maxAIGenerationsPerMonth: subscription.planType === 'basic' ? 50 : subscription.planType === 'pro' ? 500 : 2500,
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

    // Calculate current usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Count posts created this month
    const { count: postsCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfMonth.toISOString());

    // Count AI-generated content this month
    const { count: aiContentCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .or('ai_caption.not.is.null,metadata->>ai_generated.eq.true')
      .gte('created_at', startOfMonth.toISOString());

    const brandsCount = await db
      .select({ count: brands.id })
      .from(brands)
      .where(eq(brands.userId, user.id));

    const socialAccountsCount = await db
      .select({ count: socialAccounts.id })
      .from(socialAccounts)
      .where(eq(socialAccounts.userId, user.id));

    const usage = {
      postsThisMonth: postsCount || 0,
      aiGenerationsThisMonth: aiContentCount || 0,
      imagesInCurrentPost: 0, // Will be set by client
      brandsCount: brandsCount.length || 0,
      socialAccountsCount: socialAccountsCount.length || 0,
    };

    return NextResponse.json({
      limits,
      usage,
      features,
      canCreatePost: (usage.postsThisMonth || 0) < limits.maxPostsPerMonth,
      canGenerateAI: (usage.aiGenerationsThisMonth || 0) < limits.maxAIGenerationsPerMonth,
      canCreateBrand: (usage.brandsCount || 0) < limits.maxBrands,
      canConnectAccount: (usage.socialAccountsCount || 0) < limits.maxSocialAccounts,
    });
  } catch (error: any) {
    console.error('Error getting subscription limits:', error);
    return NextResponse.json({ error: 'Failed to get subscription limits' }, { status: 500 });
  }
}
