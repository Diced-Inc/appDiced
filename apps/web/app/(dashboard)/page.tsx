import { Header } from "@/components/header";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return (
    <div>
      <Header title="Overview" />
      <div className="p-6">
        <p className="text-zinc-400">Dashboard coming soon...</p>
      </div>
    </div>
  );
}
