import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Assign all unowned records to the current user
  const [appsResult, connectionsResult, syncResult] = await Promise.all([
    supabase.from("apps").update({ user_id: userId }).is("user_id", null),
    supabase
      .from("api_connections")
      .update({ user_id: userId })
      .is("user_id", null),
    supabase.from("sync_log").update({ user_id: userId }).is("user_id", null),
  ]);

  return NextResponse.json({
    success: true,
    userId,
    errors: {
      apps: appsResult.error?.message ?? null,
      connections: connectionsResult.error?.message ?? null,
      sync: syncResult.error?.message ?? null,
    },
  });
}
