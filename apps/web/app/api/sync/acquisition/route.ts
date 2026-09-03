import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listConnectedAcquisitionUsers, syncAcquisition } from "@/lib/sync/acquisition";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { lookbackDays?: unknown } | null;
  const requested = typeof body?.lookbackDays === "number" ? Math.floor(body.lookbackDays) : 14;
  const result = await syncAcquisition(userId, { lookbackDays: Math.min(Math.max(requested, 1), 366) });
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  for (const userId of await listConnectedAcquisitionUsers()) {
    results[userId] = await syncAcquisition(userId, { lookbackDays: 14 });
  }
  return NextResponse.json({ success: true, results });
}
