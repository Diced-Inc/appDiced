import type { CohortWindow } from "@/lib/campaign-detail-types";
export const shiftDate = (date: string, offset: number) => new Date(Date.parse(`${date}T12:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
export function validCohortDate(value: unknown, today: string): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && value <= today && value >= shiftDate(today, -366);
}
export function cohortWindows(date: string, today: string, spend: number, rows: { date: string; users: number; revenue: number; adRevenue: number }[]): CohortWindow[] {
  const users = rows.filter(r => r.date === date).reduce((sum, r) => sum + r.users, 0);
  return [1, 7, 30].map(day => {
    const endDate = shiftDate(date, day);
    const available = rows.filter(r => r.date >= date && r.date <= endDate && r.date <= today);
    const revenue = users > 0 ? available.reduce((sum, r) => sum + r.revenue, 0) : null;
    const adRevenue = users > 0 ? available.reduce((sum, r) => sum + r.adRevenue, 0) : null;
    return { day, endDate, complete: endDate < today, revenue, adRevenue, users,
      roas: revenue !== null && spend > 0 ? revenue / spend : null, perUser: revenue !== null && users > 0 ? revenue / users : null };
  });
}
