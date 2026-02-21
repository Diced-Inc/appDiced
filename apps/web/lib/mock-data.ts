import { DicedApp, DailyRevenue, DashboardSummary } from "./types";

export const mockApps: DicedApp[] = [
  {
    id: "1",
    name: "Diced Wallpapers",
    packageName: "com.diced.wallpapers",
    icon: "\u{1F5BC}\uFE0F",
    status: "published",
    rating: 4.5,
    downloads: 125000,
    revenue: 3420.5,
    impressions: 890000,
    ecpm: 3.84,
  },
  {
    id: "2",
    name: "Diced Notes",
    packageName: "com.diced.notes",
    icon: "\u{1F4DD}",
    status: "published",
    rating: 4.2,
    downloads: 89000,
    revenue: 2180.0,
    impressions: 540000,
    ecpm: 4.04,
  },
  {
    id: "3",
    name: "Diced Timer",
    packageName: "com.diced.timer",
    icon: "\u23F1\uFE0F",
    status: "in_review",
    rating: 0,
    downloads: 0,
    revenue: 0,
    impressions: 0,
    ecpm: 0,
  },
  {
    id: "4",
    name: "Diced Calculator",
    packageName: "com.diced.calculator",
    icon: "\u{1F522}",
    status: "published",
    rating: 4.7,
    downloads: 210000,
    revenue: 5100.75,
    impressions: 1200000,
    ecpm: 4.25,
  },
  {
    id: "5",
    name: "Diced Weather",
    packageName: "com.diced.weather",
    icon: "\u{1F324}\uFE0F",
    status: "suspended",
    rating: 3.8,
    downloads: 45000,
    revenue: 890.25,
    impressions: 210000,
    ecpm: 4.24,
  },
  {
    id: "6",
    name: "Diced Fitness",
    packageName: "com.diced.fitness",
    icon: "\u{1F4AA}",
    status: "draft",
    rating: 0,
    downloads: 0,
    revenue: 0,
    impressions: 0,
    ecpm: 0,
  },
];

export const mockDailyRevenue: DailyRevenue[] = Array.from(
  { length: 30 },
  (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split("T")[0]!,
      revenue: Math.round((Math.random() * 300 + 200) * 100) / 100,
    };
  }
);

export const mockSummary: DashboardSummary = {
  totalApps: mockApps.length,
  totalRevenue: mockApps.reduce((sum, app) => sum + app.revenue, 0),
  totalDownloads: mockApps.reduce((sum, app) => sum + app.downloads, 0),
  averageRating:
    Math.round(
      (mockApps.filter((a) => a.rating > 0).reduce((sum, a) => sum + a.rating, 0) /
        mockApps.filter((a) => a.rating > 0).length) *
        10
    ) / 10,
  revenueChange: 12.5,
  downloadsChange: 8.3,
};
