import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const [{ data: withdrawals, error: wErr }, { data: apps, error: aErr }] = await Promise.all([
    supabase
      .from("withdrawals")
      .select("id, amount, date, note, created_at")
      .eq("user_id", userId)
      .order("date", { ascending: false }),
    supabase
      .from("apps")
      .select("revenue")
      .eq("user_id", userId),
  ]);

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const totalRevenue = (apps as { revenue: number }[] | null)?.reduce(
    (s, a) => s + Number(a.revenue), 0
  ) ?? 0;

  const totalWithdrawn = (withdrawals as { amount: number }[] | null)?.reduce(
    (s, w) => s + Number(w.amount), 0
  ) ?? 0;

  const balance = Math.round((totalRevenue - totalWithdrawn) * 100) / 100;

  return NextResponse.json({
    balance,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
    withdrawals: withdrawals ?? [],
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, date, note } = await req.json();

  if (!amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("withdrawals")
    .insert({
      user_id: userId,
      amount: Number(amount),
      date,
      note: note || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
