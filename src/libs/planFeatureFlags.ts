/**
 * Feature gates for paid tiers — kept in sync with /pricing and subscription_plans (migrations).
 * DB `subscription_plans.features` json may list legacy keys; entitlements follow plan tier.
 */
export type PlanFeatureFlags = {
  pdfPptReports: boolean;
  semanticAnalysis: boolean;
  brandSentiment: boolean;
  preferredSupport: boolean;
  apiAccess: boolean;
  dedicatedSupport: boolean;
};

export function getFeatureFlagsForPlan(
  planType: 'free' | 'basic' | 'pro' | 'business' | 'trial' | string,
): PlanFeatureFlags {
  switch (planType) {
    case 'pro':
      return {
        pdfPptReports: true,
        semanticAnalysis: true,
        brandSentiment: true,
        preferredSupport: true,
        apiAccess: false,
        dedicatedSupport: false,
      };
    case 'business':
      return {
        pdfPptReports: true,
        semanticAnalysis: true,
        brandSentiment: true,
        preferredSupport: true,
        apiAccess: true,
        dedicatedSupport: true,
      };
    case 'trial':
      // Paid trial tier mirrors Pro entitlements for feature gates
      return {
        pdfPptReports: true,
        semanticAnalysis: true,
        brandSentiment: true,
        preferredSupport: true,
        apiAccess: false,
        dedicatedSupport: false,
      };
    default:
      return {
        pdfPptReports: false,
        semanticAnalysis: false,
        brandSentiment: false,
        preferredSupport: false,
        apiAccess: false,
        dedicatedSupport: false,
      };
  }
}
