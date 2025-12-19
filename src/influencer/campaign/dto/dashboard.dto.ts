// ============================================
// Dashboard Summary Response
// ============================================
export class DashboardSummaryDto {
  lifetimeEarnings: number;
  pendingEarnings: number;
  activeJobs: number;
  NewOffers: number;
}

// ============================================
// Earnings Overview Response
// ============================================
export class EarningsOverviewDto {
  totalEarnings: number;
  completedJobs: number;
  currency: string;
  timeRange: string;
  breakdown: {
    date: string;
    amount: number;
    jobCount: number;
  }[];
}
