import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { syncAdMob, listConnectedAdMobUsers } from "@/lib/sync/admob";

export const maxDuration = 300;

/**
 * Sync manual (UI) e backfill.
 * Body opcional: { lookbackDays?: number; backfillFrom?: "YYYY-MM-DD" }
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let opts: { lookbackDays?: number; backfillFrom?: string } = {};
  try {
    const body = await req.json();
    if (body && typeof body === "object") {
      if (typeof body.lookbackDays === "number" && body.lookbackDays >= 1 && body.lookbackDays <= 366) {
        opts.lookbackDays = Math.floor(body.lookbackDays);
      }
      if (typeof body.backfillFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.backfillFrom)) {
        opts.backfillFrom = body.backfillFrom;
      }
    }
  } catch {
    opts = {}; // sem body = sync padrão (7d)
  }

  const result = await syncAdMob(userId, opts);
  if ("error" in result) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json(result);
}

/** Compat: chamada via cron externo com CRON_SECRET (sincroniza todos os usuários). */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userIds = await listConnectedAdMobUsers();
  const results: Record<string, unknown> = {};
  for (const uid of userIds) {
    const r = await syncAdMob(uid, { lookbackDays: 7 });
    results[uid] = "error" in r ? `error: ${r.error}` : "skipped" in r ? r.reason : "success";
  }
  return NextResponse.json({ success: true, results });
}
