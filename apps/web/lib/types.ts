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
  impressions?: number;
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
  totalImpressions: number;
  totalDownloads: number;
  averageRating: number;
  /** % vs janela anterior de mesmo tamanho; null quando não comparável */
  revenueChange: number | null;
}

export type MonthlyEarningStatus = "open" | "closed" | "paid";

export interface MonthlyEarning {
  /** YYYY-MM-01 */
  month: string;
  gross: number;
  status: MonthlyEarningStatus;
  paidAt: string | null;
  paidAmount: number | null;
  /** data estimada do pagamento (dia ~21 do mês seguinte) */
  estimatedPayment: string;
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
