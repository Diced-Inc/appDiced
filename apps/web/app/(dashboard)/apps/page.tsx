import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { AppsTable } from "@/components/apps-table";
import { getApps } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const apps = await getApps(userId);

  return (
    <div>
      <Header title="Aplicativos" />
      <div className="p-4 md:p-6">
        <AppsTable apps={apps} />
      </div>
    </div>
  );
}
