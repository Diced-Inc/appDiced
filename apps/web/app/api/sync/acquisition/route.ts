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

  // ?lookbackDays= permite recoleta administrativa de um histórico maior que o
  // da rotina diária (teto de 366). Sem o parâmetro, o cron segue em 14 dias.
  const requested = Number(req.nextUrl.searchParams.get("lookbackDays"));
  const lookbackDays = Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), 366) : 14;

  const results: Record<string, unknown> = {};
  for (const userId of await listConnectedAcquisitionUsers()) {
    results[userId] = await syncAcquisition(userId, { lookbackDays });
  }
  return NextResponse.json({ success: true, results });
}
