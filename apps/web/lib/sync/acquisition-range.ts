/** Every collection covers the current month, while retaining older corrections. */
export function acquisitionSyncRange(today: string, requested = 14) {
  const days = Number.isFinite(requested) ? Math.min(Math.max(Math.floor(requested), 1), 366) : 14;
  const lookback = new Date(Date.parse(`${today}T12:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  return { from: lookback < monthStart ? lookback : monthStart, to: today };
}
