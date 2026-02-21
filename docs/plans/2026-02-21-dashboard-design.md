# Diced Dashboard — Design Document

**Date:** 2026-02-21
**Status:** Approved

## Summary

Internal dashboard for Diced at `app.diced.com.br` to track app status, Play Store metrics, and AdMob revenue. MVP starts with mock data, Clerk auth, and a dark-themed UI matching the Diced landing page.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Turborepo + pnpm | Vercel-native, smart caching, simple setup |
| Framework | Next.js 14+ (App Router) | RSC for server-side dashboards, modern standard |
| Auth | Clerk | Fast setup, hosted UI, single-user MVP |
| Database | Supabase (PostgreSQL) | Future use for cached API data and settings |
| Charts | Recharts | Declarative React charts, lightweight, customizable |
| Styling | Tailwind CSS (shared preset) | Consistent tokens with landing page |
| Deploy | Vercel | Native Turborepo + Next.js integration |

## Monorepo Structure

```
appDiced/
├── apps/
│   └── web/                     # Next.js (app.diced.com.br)
│       ├── app/
│       │   ├── (auth)/          # Public routes (sign-in, sign-up)
│       │   ├── (dashboard)/     # Protected routes (sidebar layout)
│       │   │   ├── page.tsx             # Overview with KPIs + charts
│       │   │   ├── apps/               # App list + detail view
│       │   │   ├── revenue/            # AdMob metrics
│       │   │   └── settings/           # Placeholder
│       │   ├── api/             # Route handlers
│       │   └── layout.tsx       # Root layout (Clerk, fonts)
│       └── ...
├── packages/
│   ├── ui/                      # Shared components (Button, Card, etc.)
│   ├── config-tailwind/         # Tailwind preset with Diced tokens
│   └── config-typescript/       # Shared tsconfig
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

## Design Tokens

```
Colors:
  violet-500: #8B5CF6
  violet-600: #7C3AED
  pink-500:   #EC4899
  surface:    #111118  (sidebar, deep bg)
  surface-2:  #1B1B26  (content area)

Fonts:
  Headings: Syne
  Body:     DM Sans
```

## Pages

### Dashboard Overview (`/`)
- KPI cards: total apps, monthly revenue, total downloads, average rating
- Line chart: revenue over last 30 days (Recharts)
- Quick list: apps with colored status badges

### Apps (`/apps`)
- Table: name, icon, status, rating, downloads, revenue
- Filter by status (published, in review, suspended)
- Click opens app detail (`/apps/[id]`) with individual metrics

### Revenue (`/revenue`)
- AdMob metrics: total revenue, impressions, eCPM
- Bar/line charts by app and period

### Settings (`/settings`)
- Placeholder for future config (API keys, preferences)

## Layout

- Fixed sidebar (left, dark `#111118`): logo, nav links, active indicator
- Header: breadcrumb + Clerk UserButton
- Content area: `#1B1B26` background, responsive grid

## Data Flow (MVP)

```
mock-data.ts (static JSON)
    → Route Handlers (app/api/)
    → Server Components (server-side fetch)
    → Client Components (charts, interactions)
```

When integrating real APIs later, only the Route Handlers change. Frontend stays the same.

## Auth Flow

- Clerk middleware protects all `(dashboard)` routes
- Unauthenticated users redirect to `(auth)/sign-in`
- Single user, no roles needed for MVP

## Future Scope (not in MVP)

- Google Play Developer API integration
- AdMob API integration
- Supabase for persisted/cached API data
- Notifications (app removed, revenue drop)
- Historical metrics
- Multiple users with roles
- Firebase integration (crashes, analytics)
