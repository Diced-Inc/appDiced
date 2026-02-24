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

  if (body.action === "advance") {
    const { data: app } = await supabase
      .from("pipeline_apps")
      .select("stage")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const currentIdx = STAGES.indexOf(app.stage as (typeof STAGES)[number]);
    if (currentIdx === STAGES.length - 1) {
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
