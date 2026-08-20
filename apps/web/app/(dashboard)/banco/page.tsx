import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { BankDashboard } from "@/components/bank-dashboard";
import { getBankData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function BancoPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const data = await getBankData(userId);

  return (
    <div>
      <Header title="Banco" />
      <div className="space-y-4 p-4 md:space-y-6 md:p-6">
        <BankDashboard initial={data} />
      </div>
    </div>
  );
}
