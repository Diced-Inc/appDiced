import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { BankDashboard } from "@/components/bank-dashboard";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BancoPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = getSupabaseAdmin();

  const [{ data: withdrawals }, { data: apps }] = await Promise.all([
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

  const totalRevenue = (apps as { revenue: number }[] | null)?.reduce(
    (s, a) => s + Number(a.revenue), 0
  ) ?? 0;

  const totalWithdrawn = (withdrawals as { amount: number }[] | null)?.reduce(
    (s, w) => s + Number(w.amount), 0
  ) ?? 0;

  const balance = Math.round((totalRevenue - totalWithdrawn) * 100) / 100;

  return (
    <div>
      <Header title="Banco" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <BankDashboard
          initial={{
            balance,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
            withdrawals: (withdrawals ?? []) as { id: string; amount: number; date: string; note: string | null; created_at: string }[],
          }}
        />
      </div>
    </div>
  );
}
