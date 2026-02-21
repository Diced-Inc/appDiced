import { Header } from "@/components/header";
import { AppsTable } from "@/components/apps-table";
import { mockApps } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default function AppsPage() {
  return (
    <div>
      <Header title="Apps" />
      <div className="p-6">
        <AppsTable apps={mockApps} />
      </div>
    </div>
  );
}
