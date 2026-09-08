export interface CreativeResult {
  id: string; name: string; status: string; thumbnail: string | null; body: string; title: string;
  spend: number; impressions: number; clicks: number; installs: number; cpi: number | null; ctr: number | null;
  creativeId: string | null;
}
export interface TrackingEvent { name: string; count: number; lastDate: string | null }
export interface TrackingReport {
  events: TrackingEvent[]; utmUsers: number; adRevenue: number; totalRevenue: number;
  range: { from: string; to: string }; thresholded: boolean; timeZone: string | null;
}
export interface CohortWindow {
  day: number; endDate: string; complete: boolean; revenue: number | null; adRevenue: number | null; users: number;
  roas: number | null; perUser: number | null;
}
export interface CohortReport { date: string; spend: number; windows: CohortWindow[]; thresholded: boolean; timeZone: string | null }
export interface CampaignHistory { id: string; kind: "decision" | "observation"; note: string | null; snapshot: Record<string, unknown> | null; created_at: string }
