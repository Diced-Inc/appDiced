import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { toBrazilDateStr } from "@/lib/date";
import { computeMonthStatus } from "@/lib/sync/monthly";
import { round2 } from "@/lib/sync/parse";

function monthLabel(month: string): string {
  return new Date(`${month}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Marca/desmarca um mês do extrato como pago.
 * Body: { month: "YYYY-MM-01", paid: boolean, amount?: number }
 * Marcar como pago também registra o recebimento em withdrawals.
 */
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const month: unknown = body?.month;
  const paid: unknown = body?.paid;
  const amount: unknown = body?.amount;

  if (typeof month !== "string" || !/^\d{4}-\d{2}-01$/.test(month)) {
    return NextResponse.json({ error: "month inválido (YYYY-MM-01)" }, { status: 400 });
  }
  if (typeof paid !== "boolean") {
    return NextResponse.json({ error: "paid deve ser boolean" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const today = toBrazilDateStr();

  const { data: rowData, error: fetchErr } = await supabase
    .from("monthly_earnings")
    .select("id, gross, status")
    .eq("user_id", userId)
    .eq("month", month)
    .single();

  if (fetchErr || !rowData) {
    return NextResponse.json({ error: "Mês não encontrado no extrato" }, { status: 404 });
  }
  const row = rowData as { id: string; gross: number; status: string };

  if (paid) {
    if (row.status === "open") {
      return NextResponse.json({ error: "Mês corrente ainda não fechou" }, { status: 400 });
    }
    const paidAmount = round2(
      typeof amount === "number" && amount > 0 ? amount : Number(row.gross)
    );

    const { error } = await supabase
      .from("monthly_earnings")
      .update({
        status: "paid",
        paid_at: today,
        paid_amount: paidAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Espelha no histórico de recebimentos
    await supabase.from("withdrawals").insert({
      user_id: userId,
      amount: paidAmount,
      date: today,
      note: `AdMob ${monthLabel(month)}`,
      month,
    });

    return NextResponse.json({ success: true, status: "paid", paidAmount });
  }

  // Desfazer: volta pro status derivado e remove o recebimento espelhado
  const { error } = await supabase
    .from("monthly_earnings")
    .update({
      status: computeMonthStatus(month, today),
      paid_at: null,
      paid_amount: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("withdrawals")
    .delete()
    .eq("user_id", userId)
    .eq("month", month)
    .like("note", "AdMob %");

  return NextResponse.json({ success: true, status: computeMonthStatus(month, today) });
}
