import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { syncPlayStore } from "@/lib/sync/play";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncPlayStore(userId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, updated: result.updated, statusChanges: result.statusChanges });
}
