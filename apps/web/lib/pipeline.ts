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
