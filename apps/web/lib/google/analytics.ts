import { getGoogleReportingAccessToken } from "@/lib/google/admob";

const ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";

export interface GA4AndroidStream {
  propertyId: string;
  propertyName: string;
  streamId: string;
  streamName: string;
  packageName: string;
}

export interface GA4DailyAcquisition {
  date: string;
  installs: number;
  adRevenue: number;
  purchaseRevenue: number;
  totalRevenue: number;
  adImpressions: number;
}

interface GA4ReportResponse {
  dimensionHeaders?: { name?: string }[];
  metricHeaders?: { name?: string }[];
  rows?: {
    dimensionValues?: { value?: string }[];
    metricValues?: { value?: string }[];
  }[];
  rowCount?: number;
  metadata?: { currencyCode?: string; timeZone?: string; subjectToThresholding?: boolean };
  error?: { message?: string };
}

interface CustomAdPaidRow {
  date: string;
  revenue: number;
  impressions: number;
}

async function googleGet<T>(url: URL, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Google Analytics API falhou (${response.status})`);
  }
  return body;
}

async function listProperties(token: string): Promise<{ id: string; name: string }[]> {
  const properties: { id: string; name: string }[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${ADMIN_API}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const body = await googleGet<{
      accountSummaries?: {
        propertySummaries?: { property?: string; displayName?: string }[];
      }[];
      nextPageToken?: string;
    }>(url, token);

    for (const account of body.accountSummaries ?? []) {
      for (const property of account.propertySummaries ?? []) {
        const id = property.property?.replace(/^properties\//, "");
        if (id) properties.push({ id, name: property.displayName || id });
      }
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return properties;
}

async function listPropertyAndroidStreams(
  token: string,
  property: { id: string; name: string }
): Promise<GA4AndroidStream[]> {
  const url = new URL(`${ADMIN_API}/properties/${property.id}/dataStreams`);
  url.searchParams.set("pageSize", "200");
  const body = await googleGet<{
    dataStreams?: {
      name?: string;
      displayName?: string;
      androidAppStreamData?: { packageName?: string };
    }[];
  }>(url, token);

  return (body.dataStreams ?? [])
    .filter((stream) => Boolean(stream.androidAppStreamData?.packageName && stream.name))
    .map((stream) => ({
      propertyId: property.id,
      propertyName: property.name,
      streamId: stream.name!.split("/").pop()!,
      streamName: stream.displayName || stream.androidAppStreamData!.packageName!,
      packageName: stream.androidAppStreamData!.packageName!,
    }));
}

export async function listGA4AndroidStreams(userId: string): Promise<GA4AndroidStream[]> {
  const token = await getGoogleReportingAccessToken(userId);
  if (!token) return [];
  const properties = await listProperties(token);
  const results = await Promise.allSettled(
    properties.map((property) => listPropertyAndroidStreams(token, property))
  );
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

function numeric(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ga4Date(value: string | undefined): string | null {
  if (!value || !/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function parseGA4AcquisitionReport(report: GA4ReportResponse): GA4DailyAcquisition[] {
  const dimensions = (report.dimensionHeaders ?? []).map((header) => header.name || "");
  const metrics = (report.metricHeaders ?? []).map((header) => header.name || "");
  const dateIndex = dimensions.indexOf("date");
  if (dateIndex < 0) return [];

  const byDate = new Map<string, GA4DailyAcquisition>();
  for (const row of report.rows ?? []) {
    const date = ga4Date(row.dimensionValues?.[dateIndex]?.value);
    if (!date) continue;
    const value = (name: string) => numeric(row.metricValues?.[metrics.indexOf(name)]?.value);
    const previous = byDate.get(date) ?? {
      date,
      installs: 0,
      adRevenue: 0,
      purchaseRevenue: 0,
      totalRevenue: 0,
      adImpressions: 0,
    };
    byDate.set(date, {
      date,
      installs: previous.installs + Math.round(value("newUsers")),
      adRevenue: previous.adRevenue + value("totalAdRevenue"),
      purchaseRevenue: previous.purchaseRevenue + value("purchaseRevenue"),
      totalRevenue: previous.totalRevenue + value("totalRevenue"),
      adImpressions: previous.adImpressions + Math.round(value("publisherAdImpressions")),
    });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function parseCustomAdPaidReport(report: GA4ReportResponse): CustomAdPaidRow[] {
  const dimensions = (report.dimensionHeaders ?? []).map((header) => header.name || "");
  const metrics = (report.metricHeaders ?? []).map((header) => header.name || "");
  const dateIndex = dimensions.indexOf("date");
  if (dateIndex < 0) return [];

  return (report.rows ?? []).flatMap((row) => {
    const date = ga4Date(row.dimensionValues?.[dateIndex]?.value);
    if (!date) return [];
    const value = (name: string) => numeric(row.metricValues?.[metrics.indexOf(name)]?.value);
    return [{ date, revenue: value("eventValue"), impressions: Math.round(value("eventCount")) }];
  });
}

interface GA4AcquisitionBaseConfig {
  propertyId: string;
  streamId: string;
  currency: string;
}

interface GA4AcquisitionConfig extends GA4AcquisitionBaseConfig {
  source: string;
  medium: string;
  campaign: string;
}

export interface GA4AcquisitionBreakdown {
  utm: GA4DailyAcquisition[];
  facebookReferral: GA4DailyAcquisition[];
}

type GA4FilterExpression = Record<string, unknown>;

function exactFilter(fieldName: string, value: string): GA4FilterExpression {
  return {
    filter: {
      fieldName,
      stringFilter: { matchType: "EXACT", value, caseSensitive: false },
    },
  };
}

export function buildUtmAcquisitionFilters(
  config: Pick<GA4AcquisitionConfig, "streamId" | "source" | "medium" | "campaign">
): GA4FilterExpression[] {
  return [
    exactFilter("streamId", config.streamId),
    exactFilter("firstUserSource", config.source),
    exactFilter("firstUserMedium", config.medium),
    exactFilter("firstUserCampaignName", config.campaign),
  ];
}

export function buildFacebookReferralFilters(streamId: string): GA4FilterExpression[] {
  return [
    exactFilter("streamId", streamId),
    exactFilter("firstUserSource", "apps.facebook.com"),
    exactFilter("firstUserCampaignName", "fb4a"),
  ];
}

async function fetchGA4AcquisitionForFilters(
  token: string,
  config: GA4AcquisitionBaseConfig,
  acquisitionFilters: GA4FilterExpression[],
  range: { from: string; to: string }
): Promise<GA4DailyAcquisition[]> {
  const endpoint = `${DATA_API}/properties/${encodeURIComponent(config.propertyId)}:runReport`;

  async function runReport(body: Record<string, unknown>): Promise<GA4ReportResponse> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    const report = (await response.json()) as GA4ReportResponse;
    if (!response.ok || report.error) {
      throw new Error(report.error?.message || `GA4 Data API falhou (${response.status})`);
    }
    return report;
  }

  const standardReport = await runReport({
    dateRanges: [{ startDate: range.from, endDate: range.to }],
    dimensions: [
      { name: "date" },
      { name: "streamId" },
      { name: "firstUserSource" },
      { name: "firstUserMedium" },
      { name: "firstUserCampaignName" },
    ],
    metrics: [
      { name: "newUsers" },
      { name: "totalAdRevenue" },
      { name: "purchaseRevenue" },
      { name: "totalRevenue" },
      { name: "publisherAdImpressions" },
    ],
    dimensionFilter: { andGroup: { expressions: acquisitionFilters } },
    currencyCode: config.currency,
    limit: "100000",
  });
  const standardRows = parseGA4AcquisitionReport(standardReport);

  // O app também envia receita impression-level no evento `ad_paid`. Ele é
  // usado como fallback quando a vinculação AdMob↔Firebase ainda não
  // preencheu totalAdRevenue. Nunca somamos os dois para não duplicar receita.
  let customRows: CustomAdPaidRow[] = [];
  try {
    const customReport = await runReport({
      dateRanges: [{ startDate: range.from, endDate: range.to }],
      dimensions: [
        { name: "date" },
        { name: "streamId" },
        { name: "firstUserSource" },
        { name: "firstUserMedium" },
        { name: "firstUserCampaignName" },
        { name: "eventName" },
      ],
      metrics: [{ name: "eventValue" }, { name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            ...acquisitionFilters,
            exactFilter("eventName", "ad_paid"),
          ],
        },
      },
      currencyCode: config.currency,
      limit: "100000",
    });
    customRows = parseCustomAdPaidReport(customReport);
  } catch {
    // totalAdRevenue continua sendo a fonte oficial quando o fallback não é compatível.
  }

  const byDate = new Map(standardRows.map((row) => [row.date, row]));
  for (const custom of customRows) {
    const standard = byDate.get(custom.date) ?? {
      date: custom.date,
      installs: 0,
      adRevenue: 0,
      purchaseRevenue: 0,
      totalRevenue: 0,
      adImpressions: 0,
    };
    const effectiveAdRevenue = Math.max(standard.adRevenue, custom.revenue);
    byDate.set(custom.date, {
      ...standard,
      adRevenue: effectiveAdRevenue,
      totalRevenue: standard.totalRevenue - standard.adRevenue + effectiveAdRevenue,
      adImpressions: Math.max(standard.adImpressions, custom.impressions),
    });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchGA4AcquisitionReport(
  userId: string,
  config: GA4AcquisitionConfig,
  range: { from: string; to: string }
): Promise<GA4DailyAcquisition[]> {
  const token = await getGoogleReportingAccessToken(userId);
  if (!token) throw new Error("Conexão Google/AdMob ausente; reconecte em Configurações");
  return fetchGA4AcquisitionForFilters(token, config, buildUtmAcquisitionFilters(config), range);
}

export async function fetchGA4AcquisitionBreakdown(
  userId: string,
  config: GA4AcquisitionConfig,
  range: { from: string; to: string }
): Promise<GA4AcquisitionBreakdown> {
  const token = await getGoogleReportingAccessToken(userId);
  if (!token) throw new Error("Conexão Google/AdMob ausente; reconecte em Configurações");

  const [utm, facebookReferral] = await Promise.all([
    fetchGA4AcquisitionForFilters(token, config, buildUtmAcquisitionFilters(config), range),
    fetchGA4AcquisitionForFilters(token, config, buildFacebookReferralFilters(config.streamId), range),
  ]);
  return { utm, facebookReferral };
}
