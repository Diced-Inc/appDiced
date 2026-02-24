import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PipelineApp, PipelineInsight, PipelineStage } from "./types";

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

interface InsightRow {
  id: string;
  name: string;
  platforms: string[];
  notes: string;
  created_at: string;
}

export async function getPipelineInsights(userId: string): Promise<PipelineInsight[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pipeline_insights")
    .select("id, name, platforms, notes, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch pipeline insights:", error);
    return [];
  }

  return ((data as InsightRow[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    platforms: r.platforms ?? [],
    notes: r.notes ?? "",
    createdAt: r.created_at,
  }));
}
