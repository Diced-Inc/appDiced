# Pipeline (Esteira de Produção) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Kanban pipeline board for tracking apps through 6 fixed production stages with a 14-day countdown timer for closed testing.

**Architecture:** New `/pipeline` route with client-side board component. Separate `pipeline_apps` DB table. CRUD API routes. No drag-and-drop — button-driven stage advancement.

**Tech Stack:** Next.js App Router, Supabase, Tailwind CSS, inline Heroicon SVGs (matching sidebar style).

---

### Task 1: Database Migration

**Files:**
- Create: `apps/web/migration-pipeline.sql`

**Step 1: Write migration SQL**

```sql
CREATE TABLE IF NOT EXISTS pipeline_apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  package_name TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT 'code',
  stage_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pipeline_apps_user ON pipeline_apps (user_id);
```

**Step 2: Commit**

```bash
git add apps/web/migration-pipeline.sql
git commit -m "feat(pipeline): add migration for pipeline_apps table"
```

> **Note:** User must run this SQL in Supabase SQL Editor before the feature works.

---

### Task 2: Types and Data Layer

**Files:**
- Modify: `apps/web/lib/types.ts` — add PipelineStage type and PipelineApp interface
- Create: `apps/web/lib/pipeline.ts` — data access functions

**Step 1: Add types to `apps/web/lib/types.ts`**

Append at end of file:

```typescript
export type PipelineStage = "code" | "play_store" | "testers" | "closed_test" | "admob_banners" | "ads_version";

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
```

**Step 2: Create `apps/web/lib/pipeline.ts`**

```typescript
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PipelineApp, PipelineStage } from "./types";

interface PipelineRow {
  id: string;
  name: string;
  package_name: string;
  icon: string;
  stage: string;
  stage_entered_at: string;
  created_at: string;
  completed_at: string | null;
}

function mapRow(row: PipelineRow): PipelineApp {
  return {
    id: row.id,
    name: row.name,
    packageName: row.package_name,
    icon: row.icon,
    stage: row.stage as PipelineStage,
    stageEnteredAt: row.stage_entered_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function getPipelineApps(userId: string): Promise<PipelineApp[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pipeline_apps")
    .select("id, name, package_name, icon, stage, stage_entered_at, created_at, completed_at")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch pipeline apps:", error);
    return [];
  }

  return ((data as PipelineRow[]) ?? []).map(mapRow);
}
```

**Step 3: Commit**

```bash
git add apps/web/lib/types.ts apps/web/lib/pipeline.ts
git commit -m "feat(pipeline): add types and data layer"
```

---

### Task 3: API Routes

**Files:**
- Create: `apps/web/app/api/pipeline/route.ts` — GET (list) + POST (create)
- Create: `apps/web/app/api/pipeline/[id]/route.ts` — PATCH (advance) + DELETE

**Step 1: Create `apps/web/app/api/pipeline/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pipeline_apps")
    .select("*")
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, package_name, icon } = await req.json();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pipeline_apps")
    .insert({
      user_id: userId,
      name,
      package_name: package_name ?? "",
      icon: icon ?? "",
      stage: "code",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

**Step 2: Create `apps/web/app/api/pipeline/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const STAGES = ["code", "play_store", "testers", "closed_test", "admob_banners", "ads_version"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = getSupabaseAdmin();

  // If action is "advance", move to next stage
  if (body.action === "advance") {
    const { data: app } = await supabase
      .from("pipeline_apps")
      .select("stage")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const currentIdx = STAGES.indexOf(app.stage as typeof STAGES[number]);
    if (currentIdx === STAGES.length - 1) {
      // Last stage — mark completed
      await supabase
        .from("pipeline_apps")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
      return NextResponse.json({ success: true, completed: true });
    }

    const nextStage = STAGES[currentIdx + 1];
    await supabase
      .from("pipeline_apps")
      .update({ stage: nextStage, stage_entered_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    return NextResponse.json({ success: true, stage: nextStage });
  }

  // Generic update (name, icon, etc.)
  const allowed = ["name", "package_name", "icon", "stage"];
  const updates: Record<string, unknown> = {};
  for (const f of allowed) {
    if (f in body) updates[f] = body[f];
  }
  if ("stage" in updates) updates["stage_entered_at"] = new Date().toISOString();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("pipeline_apps")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from("pipeline_apps")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

**Step 3: Commit**

```bash
git add apps/web/app/api/pipeline/
git commit -m "feat(pipeline): add CRUD API routes"
```

---

### Task 4: Pipeline Board Component

**Files:**
- Create: `apps/web/components/pipeline-board.tsx` — the full kanban client component

This is the main UI. It's a "use client" component that:
- Receives initial data via props (server-fetched)
- Renders 6 columns with stage headers + count badges
- Shows app cards with icon, name, package_name
- "Teste Fechado" cards show countdown: "Dia X/14 — faltam Y"
- "Avançar" button on each card, "Concluir" on last stage
- "Novo App" button opens inline form (not separate modal — simpler)
- Horizontal scroll on mobile
- Calls API routes for mutations, refreshes with `router.refresh()`

**Stage display config:**

```typescript
const STAGES = [
  { key: "code", label: "Código", color: "text-blue-400" },
  { key: "play_store", label: "Play Store", color: "text-green-400" },
  { key: "testers", label: "Testers", color: "text-yellow-400" },
  { key: "closed_test", label: "Teste Fechado", color: "text-orange-400" },
  { key: "admob_banners", label: "Banners AdMob", color: "text-pink-400" },
  { key: "ads_version", label: "Versão com Ads", color: "text-violet-400" },
] as const;
```

**Countdown logic for `closed_test` stage:**

```typescript
const entered = new Date(app.stageEnteredAt);
const now = new Date();
const diffMs = now.getTime() - entered.getTime();
const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // Day 1 on entry
const daysLeft = Math.max(0, 14 - daysPassed);
// Display: "Dia {daysPassed}/14 — faltam {daysLeft}"
```

**Step 1: Create the component** (full implementation — code provided during execution)

**Step 2: Commit**

```bash
git add apps/web/components/pipeline-board.tsx
git commit -m "feat(pipeline): add kanban board component"
```

---

### Task 5: Pipeline Page

**Files:**
- Create: `apps/web/app/(dashboard)/pipeline/page.tsx`

**Step 1: Create the page**

```typescript
import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { PipelineBoard } from "@/components/pipeline-board";
import { getPipelineApps } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { userId } = await auth();
  if (!userId) return null;

  const apps = await getPipelineApps(userId);

  return (
    <div>
      <Header title="Esteira de Produção" />
      <div className="p-4 md:p-6">
        <PipelineBoard apps={apps} />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/pipeline/
git commit -m "feat(pipeline): add pipeline page"
```

---

### Task 6: Sidebar Navigation

**Files:**
- Modify: `apps/web/components/sidebar.tsx`

**Step 1: Add Pipeline nav item and icon**

In `navItems` array, insert between "Aplicativos" and "Receita":

```typescript
{ href: "/pipeline", label: "Pipeline", icon: "Pipeline" },
```

In `icons` object, add Pipeline icon (Heroicons `arrow-right-circle` or flow-style):

```typescript
Pipeline: (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
  </svg>
),
```

**Step 2: Commit**

```bash
git add apps/web/components/sidebar.tsx
git commit -m "feat(pipeline): add Pipeline to sidebar navigation"
```

---

### Task 7: Build, Push, Deploy

**Step 1: Run build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

**Step 2: Commit any fixes if needed, then push and deploy**

```bash
git push
npx vercel --prod
```

---

### Post-Implementation

Remind user to:
1. Run `migration-pipeline.sql` in Supabase SQL Editor
2. Test creating an app, advancing through stages, and the countdown timer
