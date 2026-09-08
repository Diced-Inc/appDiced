export function decisionText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= 2000 ? text : null;
}
export function exclusiveUtm(current: { ga4_property_id: string; ga4_stream_id: string; utm_source: string; utm_medium: string; utm_campaign: string; id: string }, siblings: typeof current[]): boolean {
  return !siblings.some(other => other.id !== current.id &&
    other.ga4_property_id === current.ga4_property_id && other.ga4_stream_id === current.ga4_stream_id &&
    other.utm_source.toLowerCase() === current.utm_source.toLowerCase() && other.utm_medium.toLowerCase() === current.utm_medium.toLowerCase() && other.utm_campaign.toLowerCase() === current.utm_campaign.toLowerCase());
}
