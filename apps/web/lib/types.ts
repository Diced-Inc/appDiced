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

export interface AdUnitRevenue {
  adUnitId: string;
  adUnitName: string;
  revenue: number;
  impressions: number;
  ecpm: number;
  date: string;
}

export interface DashboardSummary {
  totalApps: number;
  totalRevenue: number;
  totalDownloads: number;
  averageRating: number;
  revenueChange: number;
  downloadsChange: number;
}

export type PipelineStage = "code" | "play_store" | "testers" | "closed_test" | "admob_banners" | "ads_version";

export interface PipelineInsight {
  id: string;
  name: string;
  platforms: string[];
  notes: string;
  createdAt: string;
}

export interface PipelineApp {
  id: string;
  name: string;
  packageName: string;
  icon: string;
  stage: PipelineStage;
  stageEnteredAt: string;
  createdAt: string;
  completedAt: string | null;
}
