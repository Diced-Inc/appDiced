export type AppStatus = "published" | "in_review" | "suspended" | "draft" | "removed";

export interface DicedApp {
  id: string;
  name: string;
  packageName: string;
  icon: string;
  status: AppStatus;
  rating: number;
  downloads: number;
  revenue: number;
  impressions: number;
  ecpm: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  appId?: string;
}

export interface CountryRevenue {
  countryCode: string;
  revenue: number;
  impressions: number;
}

export interface DashboardSummary {
  totalApps: number;
  totalRevenue: number;
  totalDownloads: number;
  averageRating: number;
  revenueChange: number;
  downloadsChange: number;
}
