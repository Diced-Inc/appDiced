# Diced Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an internal dashboard MVP at `app.diced.com.br` with Clerk auth, dark theme, mock data, and Recharts visualizations.

**Architecture:** Turborepo monorepo with a single Next.js App Router app (`apps/web`), shared packages for UI components, Tailwind config, and TypeScript config. Clerk middleware protects dashboard routes. Mock data served via route handlers, consumed by Server Components, rendered by Client Components (charts).

**Tech Stack:** Turborepo, pnpm, Next.js 15, Clerk, Tailwind CSS 3, Recharts, TypeScript

---

## Task 1: Scaffold Turborepo Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`

**Step 1: Initialize git repo**

```bash
cd e:/APPS/appDiced
git init
```

**Step 2: Create root `package.json`**

```json
{
  "name": "app-diced",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "check-types": "turbo run check-types",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  }
}
```

> **Note:** Adjust `packageManager` version to match your local `pnpm --version` output.

**Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

**Step 5: Create `.gitignore`**

```
node_modules/
.next/
.turbo/
dist/
.env*.local
.vercel
```

**Step 6: Install dependencies**

```bash
pnpm install
```

**Step 7: Commit**

```bash
git add .
git commit -m "chore: scaffold turborepo monorepo"
```

---

## Task 2: Create Shared TypeScript Config Package

**Files:**
- Create: `packages/config-typescript/package.json`
- Create: `packages/config-typescript/base.json`
- Create: `packages/config-typescript/nextjs.json`
- Create: `packages/config-typescript/react-library.json`

**Step 1: Create `packages/config-typescript/package.json`**

```json
{
  "name": "@diced/typescript-config",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "nextjs.json", "react-library.json"]
}
```

**Step 2: Create `packages/config-typescript/base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "incremental": false,
    "isolatedModules": true,
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleDetection": "force",
    "moduleResolution": "NodeNext",
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022"
  }
}
```

**Step 3: Create `packages/config-typescript/nextjs.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "jsx": "preserve",
    "noEmit": true,
    "plugins": [{ "name": "next" }]
  }
}
```

**Step 4: Create `packages/config-typescript/react-library.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "jsx": "react-jsx",
    "noEmit": true
  }
}
```

**Step 5: Commit**

```bash
git add packages/config-typescript/
git commit -m "chore: add shared typescript config package"
```

---

## Task 3: Create Shared Tailwind Config Package

**Files:**
- Create: `packages/config-tailwind/package.json`
- Create: `packages/config-tailwind/tailwind.config.ts`
- Create: `packages/config-tailwind/tsconfig.json`

**Step 1: Create `packages/config-tailwind/package.json`**

```json
{
  "name": "@diced/tailwind-config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    ".": "./tailwind.config.ts"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create `packages/config-tailwind/tailwind.config.ts`**

Diced design tokens from the landing page:

```typescript
import type { Config } from "tailwindcss";

const config: Omit<Config, "content"> = {
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#111118",
          2: "#1B1B26",
        },
      },
      fontFamily: {
        heading: ["Syne", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

> **Note:** violet-500/600 and pink-500 are already in Tailwind's default palette, so no need to redeclare them.

**Step 3: Create `packages/config-tailwind/tsconfig.json`**

```json
{
  "extends": "@diced/typescript-config/base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["tailwind.config.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Install deps from root**

```bash
pnpm install
```

**Step 5: Commit**

```bash
git add packages/config-tailwind/
git commit -m "chore: add shared tailwind config with Diced design tokens"
```

---

## Task 4: Create Shared UI Package

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/card.tsx`
- Create: `packages/ui/src/kpi-card.tsx`
- Create: `packages/ui/src/badge.tsx`

**Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@diced/ui",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./card": "./src/card.tsx",
    "./kpi-card": "./src/kpi-card.tsx",
    "./badge": "./src/badge.tsx"
  },
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "devDependencies": {
    "@diced/typescript-config": "workspace:*",
    "@types/react": "^19.0.0",
    "react": "^19.0.0",
    "typescript": "^5.7.0"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

**Step 2: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "@diced/typescript-config/react-library.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create `packages/ui/src/card.tsx`**

```tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/5 bg-surface-2 p-6 ${className}`}
    >
      {children}
    </div>
  );
}
```

**Step 4: Create `packages/ui/src/kpi-card.tsx`**

```tsx
import { Card } from "./card";

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}

export function KpiCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon,
}: KpiCardProps) {
  const changeColor = {
    positive: "text-emerald-400",
    negative: "text-red-400",
    neutral: "text-zinc-400",
  }[changeType];

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white font-heading">
            {value}
          </p>
          {change && (
            <p className={`mt-1 text-sm ${changeColor}`}>{change}</p>
          )}
        </div>
        <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
          {icon}
        </div>
      </div>
    </Card>
  );
}
```

**Step 5: Create `packages/ui/src/badge.tsx`**

```tsx
type BadgeVariant = "success" | "warning" | "error" | "info" | "default";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  default: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
```

**Step 6: Commit**

```bash
git add packages/ui/
git commit -m "feat: add shared UI package with Card, KpiCard, Badge components"
```

---

## Task 5: Scaffold Next.js App

**Files:**
- Create: `apps/web/` (via create-next-app or manual)
- Modify: `apps/web/package.json` (add workspace deps)
- Create: `apps/web/tailwind.config.ts` (use shared preset)
- Create: `apps/web/tsconfig.json`
- Modify: `apps/web/next.config.ts` (transpilePackages)

**Step 1: Create Next.js app**

```bash
cd e:/APPS/appDiced/apps
pnpm create next-app@latest web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-pnpm --no-turbopack
```

**Step 2: Update `apps/web/package.json`**

Add workspace dependencies:

```json
{
  "dependencies": {
    "@diced/ui": "workspace:*"
  },
  "devDependencies": {
    "@diced/tailwind-config": "workspace:*",
    "@diced/typescript-config": "workspace:*"
  }
}
```

**Step 3: Update `apps/web/tsconfig.json`**

```json
{
  "extends": "@diced/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Update `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";
import sharedConfig from "@diced/tailwind-config";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  presets: [sharedConfig],
};

export default config;
```

**Step 5: Update `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@diced/ui"],
};

export default nextConfig;
```

**Step 6: Install Google Fonts (Syne + DM Sans) in `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-heading",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Diced Dashboard",
  description: "Internal dashboard for Diced apps",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body
        className={`${syne.variable} ${dmSans.variable} font-body bg-surface text-white antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

**Step 7: Update `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 8: Install deps, verify build**

```bash
cd e:/APPS/appDiced
pnpm install
pnpm build
```

**Step 9: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js app with shared configs and fonts"
```

---

## Task 6: Set Up Clerk Authentication

**Files:**
- Modify: `apps/web/package.json` (add @clerk/nextjs)
- Create: `apps/web/.env.local` (Clerk keys)
- Create: `apps/web/middleware.ts`
- Modify: `apps/web/app/layout.tsx` (wrap with ClerkProvider)
- Create: `apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx`

**Step 1: Install Clerk**

```bash
cd e:/APPS/appDiced/apps/web
pnpm add @clerk/nextjs
```

**Step 2: Create `apps/web/.env.local`**

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

> **Action required:** Get keys from https://dashboard.clerk.com and replace placeholders.

**Step 3: Create `apps/web/middleware.ts`**

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Step 4: Update `apps/web/app/layout.tsx`**

Wrap with ClerkProvider (add import and wrapper around `<html>`):

```tsx
import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-heading",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Diced Dashboard",
  description: "Internal dashboard for Diced apps",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="pt-BR">
        <body
          className={`${syne.variable} ${dmSans.variable} font-body bg-surface text-white antialiased`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Step 5: Create sign-in page**

`apps/web/app/(auth)/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <SignIn />
    </div>
  );
}
```

**Step 6: Create sign-up page**

`apps/web/app/(auth)/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <SignUp />
    </div>
  );
}
```

**Step 7: Verify auth works**

```bash
cd e:/APPS/appDiced
pnpm dev
```

Visit `http://localhost:3000` — should redirect to sign-in page.

**Step 8: Commit**

```bash
git add apps/web/middleware.ts apps/web/app/
git commit -m "feat: add Clerk authentication with sign-in/sign-up pages"
```

---

## Task 7: Create Dashboard Layout (Sidebar + Header)

**Files:**
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/components/sidebar.tsx`
- Create: `apps/web/components/header.tsx`

**Step 1: Create `apps/web/components/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview", icon: "LayoutDashboard" },
  { href: "/apps", label: "Apps", icon: "Smartphone" },
  { href: "/revenue", label: "Revenue", icon: "DollarSign" },
  { href: "/settings", label: "Settings", icon: "Settings" },
];

// Simple SVG icons to avoid adding lucide-react dependency
const icons: Record<string, React.ReactNode> = {
  LayoutDashboard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  Smartphone: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  ),
  DollarSign: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Settings: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-white/5 bg-surface">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500" />
        <span className="text-lg font-bold font-heading">Diced</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-violet-500/10 text-violet-400"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {icons[item.icon]}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Step 2: Create `apps/web/components/header.tsx`**

```tsx
import { UserButton } from "@clerk/nextjs";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-white/5 px-6">
      <h1 className="text-xl font-bold font-heading">{title}</h1>
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-9 w-9",
          },
        }}
      />
    </header>
  );
}
```

**Step 3: Create `apps/web/app/(dashboard)/layout.tsx`**

```tsx
import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-64 bg-surface-2 min-h-screen">{children}</main>
    </div>
  );
}
```

**Step 4: Create placeholder `apps/web/app/(dashboard)/page.tsx`**

```tsx
import { Header } from "@/components/header";

export default function OverviewPage() {
  return (
    <div>
      <Header title="Overview" />
      <div className="p-6">
        <p className="text-zinc-400">Dashboard coming soon...</p>
      </div>
    </div>
  );
}
```

**Step 5: Verify layout renders**

```bash
pnpm dev
```

Visit `http://localhost:3000` — should show sidebar + header + placeholder content.

**Step 6: Commit**

```bash
git add apps/web/components/ apps/web/app/
git commit -m "feat: add dashboard layout with sidebar and header"
```

---

## Task 8: Create Mock Data

**Files:**
- Create: `apps/web/lib/mock-data.ts`
- Create: `apps/web/lib/types.ts`

**Step 1: Create `apps/web/lib/types.ts`**

```typescript
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
}

export interface DashboardSummary {
  totalApps: number;
  totalRevenue: number;
  totalDownloads: number;
  averageRating: number;
  revenueChange: number;
  downloadsChange: number;
}
```

**Step 2: Create `apps/web/lib/mock-data.ts`**

```typescript
import { DicedApp, DailyRevenue, DashboardSummary } from "./types";

export const mockApps: DicedApp[] = [
  {
    id: "1",
    name: "Diced Wallpapers",
    packageName: "com.diced.wallpapers",
    icon: "🖼️",
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
    icon: "📝",
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
    icon: "⏱️",
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
    icon: "🔢",
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
    icon: "🌤️",
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
    icon: "💪",
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
```

**Step 3: Commit**

```bash
git add apps/web/lib/
git commit -m "feat: add mock data and type definitions"
```

---

## Task 9: Build Overview Page (KPIs + Revenue Chart)

**Files:**
- Modify: `apps/web/app/(dashboard)/page.tsx`
- Create: `apps/web/components/revenue-chart.tsx`
- Create: `apps/web/components/app-status-list.tsx`

**Step 1: Install Recharts**

```bash
cd e:/APPS/appDiced/apps/web
pnpm add recharts
```

**Step 2: Create `apps/web/components/revenue-chart.tsx`**

```tsx
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyRevenue } from "@/lib/types";

interface RevenueChartProps {
  data: DailyRevenue[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis
            dataKey="date"
            stroke="#71717a"
            fontSize={12}
            tickFormatter={(value: string) => {
              const d = new Date(value);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
          />
          <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1B1B26",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "12px",
              color: "#fff",
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
            labelFormatter={(label: string) => {
              const d = new Date(label);
              return d.toLocaleDateString("pt-BR");
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#8B5CF6"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 3: Create `apps/web/components/app-status-list.tsx`**

```tsx
import type { DicedApp, AppStatus } from "@/lib/types";
import { Badge } from "@diced/ui/badge";

const statusVariant: Record<AppStatus, "success" | "warning" | "error" | "info" | "default"> = {
  published: "success",
  in_review: "warning",
  suspended: "error",
  draft: "default",
  removed: "error",
};

const statusLabel: Record<AppStatus, string> = {
  published: "Published",
  in_review: "In Review",
  suspended: "Suspended",
  draft: "Draft",
  removed: "Removed",
};

interface AppStatusListProps {
  apps: DicedApp[];
}

export function AppStatusList({ apps }: AppStatusListProps) {
  return (
    <div className="space-y-3">
      {apps.map((app) => (
        <div
          key={app.id}
          className="flex items-center justify-between rounded-xl border border-white/5 bg-surface px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{app.icon}</span>
            <div>
              <p className="text-sm font-medium text-white">{app.name}</p>
              <p className="text-xs text-zinc-500">{app.packageName}</p>
            </div>
          </div>
          <Badge variant={statusVariant[app.status]}>
            {statusLabel[app.status]}
          </Badge>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: Update `apps/web/app/(dashboard)/page.tsx`**

```tsx
import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { AppStatusList } from "@/components/app-status-list";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { mockSummary, mockDailyRevenue, mockApps } from "@/lib/mock-data";

export default function OverviewPage() {
  return (
    <div>
      <Header title="Overview" />
      <div className="space-y-6 p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Total Apps"
            value={String(mockSummary.totalApps)}
            icon={<span className="text-lg">📱</span>}
          />
          <KpiCard
            title="Monthly Revenue"
            value={`$${mockSummary.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={`+${mockSummary.revenueChange}%`}
            changeType="positive"
            icon={<span className="text-lg">💰</span>}
          />
          <KpiCard
            title="Total Downloads"
            value={mockSummary.totalDownloads.toLocaleString()}
            change={`+${mockSummary.downloadsChange}%`}
            changeType="positive"
            icon={<span className="text-lg">📥</span>}
          />
          <KpiCard
            title="Avg Rating"
            value={String(mockSummary.averageRating)}
            icon={<span className="text-lg">⭐</span>}
          />
        </div>

        {/* Charts + App List */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold font-heading">
              Revenue (Last 30 Days)
            </h2>
            <RevenueChart data={mockDailyRevenue} />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold font-heading">
              App Status
            </h2>
            <AppStatusList apps={mockApps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Verify page renders**

```bash
pnpm dev
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: build overview page with KPI cards, revenue chart, app list"
```

---

## Task 10: Build Apps Page

**Files:**
- Create: `apps/web/app/(dashboard)/apps/page.tsx`
- Create: `apps/web/app/(dashboard)/apps/[id]/page.tsx`
- Create: `apps/web/components/apps-table.tsx`

**Step 1: Create `apps/web/components/apps-table.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { AppStatus, DicedApp } from "@/lib/types";
import { Badge } from "@diced/ui/badge";

const statusVariant: Record<AppStatus, "success" | "warning" | "error" | "info" | "default"> = {
  published: "success",
  in_review: "warning",
  suspended: "error",
  draft: "default",
  removed: "error",
};

const statusLabel: Record<AppStatus, string> = {
  published: "Published",
  in_review: "In Review",
  suspended: "Suspended",
  draft: "Draft",
  removed: "Removed",
};

const filters: { label: string; value: AppStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Published", value: "published" },
  { label: "In Review", value: "in_review" },
  { label: "Suspended", value: "suspended" },
  { label: "Draft", value: "draft" },
];

interface AppsTableProps {
  apps: DicedApp[];
}

export function AppsTable({ apps }: AppsTableProps) {
  const [filter, setFilter] = useState<AppStatus | "all">("all");

  const filtered = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? "bg-violet-500/10 text-violet-400"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/5 bg-surface">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-400">App</th>
              <th className="px-4 py-3 font-medium text-zinc-400">Status</th>
              <th className="px-4 py-3 font-medium text-zinc-400 text-right">Rating</th>
              <th className="px-4 py-3 font-medium text-zinc-400 text-right">Downloads</th>
              <th className="px-4 py-3 font-medium text-zinc-400 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((app) => (
              <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/apps/${app.id}`} className="flex items-center gap-3">
                    <span className="text-xl">{app.icon}</span>
                    <div>
                      <p className="font-medium text-white">{app.name}</p>
                      <p className="text-xs text-zinc-500">{app.packageName}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[app.status]}>
                    {statusLabel[app.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {app.rating > 0 ? `${app.rating} ⭐` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {app.downloads > 0 ? app.downloads.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {app.revenue > 0 ? `$${app.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Create `apps/web/app/(dashboard)/apps/page.tsx`**

```tsx
import { Header } from "@/components/header";
import { AppsTable } from "@/components/apps-table";
import { mockApps } from "@/lib/mock-data";

export default function AppsPage() {
  return (
    <div>
      <Header title="Apps" />
      <div className="p-6">
        <AppsTable apps={mockApps} />
      </div>
    </div>
  );
}
```

**Step 3: Create `apps/web/app/(dashboard)/apps/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { KpiCard } from "@diced/ui/kpi-card";
import { Badge } from "@diced/ui/badge";
import { mockApps } from "@/lib/mock-data";
import type { AppStatus } from "@/lib/types";

const statusVariant: Record<AppStatus, "success" | "warning" | "error" | "info" | "default"> = {
  published: "success",
  in_review: "warning",
  suspended: "error",
  draft: "default",
  removed: "error",
};

const statusLabel: Record<AppStatus, string> = {
  published: "Published",
  in_review: "In Review",
  suspended: "Suspended",
  draft: "Draft",
  removed: "Removed",
};

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = mockApps.find((a) => a.id === id);

  if (!app) return notFound();

  return (
    <div>
      <Header title={app.name} />
      <div className="space-y-6 p-6">
        {/* App Info */}
        <div className="flex items-center gap-4">
          <span className="text-4xl">{app.icon}</span>
          <div>
            <h2 className="text-2xl font-bold font-heading">{app.name}</h2>
            <p className="text-sm text-zinc-400">{app.packageName}</p>
          </div>
          <Badge variant={statusVariant[app.status]}>
            {statusLabel[app.status]}
          </Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Rating"
            value={app.rating > 0 ? String(app.rating) : "N/A"}
            icon={<span className="text-lg">⭐</span>}
          />
          <KpiCard
            title="Downloads"
            value={app.downloads > 0 ? app.downloads.toLocaleString() : "N/A"}
            icon={<span className="text-lg">📥</span>}
          />
          <KpiCard
            title="Revenue"
            value={app.revenue > 0 ? `$${app.revenue.toFixed(2)}` : "N/A"}
            icon={<span className="text-lg">💰</span>}
          />
          <KpiCard
            title="eCPM"
            value={app.ecpm > 0 ? `$${app.ecpm.toFixed(2)}` : "N/A"}
            icon={<span className="text-lg">📊</span>}
          />
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: build apps page with table, filters, and detail view"
```

---

## Task 11: Build Revenue Page

**Files:**
- Create: `apps/web/app/(dashboard)/revenue/page.tsx`
- Create: `apps/web/components/revenue-by-app-chart.tsx`

**Step 1: Create `apps/web/components/revenue-by-app-chart.tsx`**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DicedApp } from "@/lib/types";

interface RevenueByAppChartProps {
  apps: DicedApp[];
}

export function RevenueByAppChart({ apps }: RevenueByAppChartProps) {
  const data = apps
    .filter((a) => a.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .map((a) => ({ name: a.name.replace("Diced ", ""), revenue: a.revenue }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
          <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
          <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1B1B26",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "12px",
              color: "#fff",
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
          />
          <Bar dataKey="revenue" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**Step 2: Create `apps/web/app/(dashboard)/revenue/page.tsx`**

```tsx
import { Header } from "@/components/header";
import { RevenueChart } from "@/components/revenue-chart";
import { RevenueByAppChart } from "@/components/revenue-by-app-chart";
import { KpiCard } from "@diced/ui/kpi-card";
import { Card } from "@diced/ui/card";
import { mockApps, mockDailyRevenue, mockSummary } from "@/lib/mock-data";

export default function RevenuePage() {
  const totalImpressions = mockApps.reduce((sum, a) => sum + a.impressions, 0);
  const avgEcpm =
    Math.round(
      (mockApps.filter((a) => a.ecpm > 0).reduce((sum, a) => sum + a.ecpm, 0) /
        mockApps.filter((a) => a.ecpm > 0).length) *
        100
    ) / 100;

  return (
    <div>
      <Header title="Revenue" />
      <div className="space-y-6 p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Total Revenue"
            value={`$${mockSummary.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            change={`+${mockSummary.revenueChange}%`}
            changeType="positive"
            icon={<span className="text-lg">💰</span>}
          />
          <KpiCard
            title="Total Impressions"
            value={totalImpressions.toLocaleString()}
            icon={<span className="text-lg">👁️</span>}
          />
          <KpiCard
            title="Avg eCPM"
            value={`$${avgEcpm}`}
            icon={<span className="text-lg">📊</span>}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-lg font-semibold font-heading">
              Daily Revenue
            </h2>
            <RevenueChart data={mockDailyRevenue} />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-semibold font-heading">
              Revenue by App
            </h2>
            <RevenueByAppChart apps={mockApps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: build revenue page with daily and per-app charts"
```

---

## Task 12: Build Settings Page

**Files:**
- Create: `apps/web/app/(dashboard)/settings/page.tsx`

**Step 1: Create `apps/web/app/(dashboard)/settings/page.tsx`**

```tsx
import { Header } from "@/components/header";
import { Card } from "@diced/ui/card";

export default function SettingsPage() {
  return (
    <div>
      <Header title="Settings" />
      <div className="p-6">
        <Card>
          <h2 className="text-lg font-semibold font-heading">Settings</h2>
          <p className="mt-2 text-sm text-zinc-400">
            API integrations and preferences will be available here in a future update.
          </p>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add settings placeholder page"
```

---

## Task 13: Final Verification and Polish

**Step 1: Run build**

```bash
cd e:/APPS/appDiced
pnpm build
```

Expected: Build succeeds with no errors.

**Step 2: Run type check**

```bash
pnpm check-types
```

Expected: No type errors.

**Step 3: Run dev and manually verify all pages**

```bash
pnpm dev
```

Checklist:
- [ ] `/sign-in` — Clerk sign-in renders
- [ ] `/` — Overview page with KPIs, chart, app list
- [ ] `/apps` — Table with filters working
- [ ] `/apps/1` — Detail page with app KPIs
- [ ] `/revenue` — Revenue charts render
- [ ] `/settings` — Placeholder renders
- [ ] Sidebar navigation works, active state highlights correctly
- [ ] Dark theme consistent across all pages

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: final polish and verification"
```
