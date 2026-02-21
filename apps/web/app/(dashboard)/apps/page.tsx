import { Header } from "@/components/header";
import { AppsTable } from "@/components/apps-table";
import { getApps } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppsPage() {
  const apps = await getApps();

  return (
    <div>
      <Header title="Apps" />
      <div className="p-4 md:p-6">
        <AppsTable apps={apps} />
      </div>
    </div>
  );
}
