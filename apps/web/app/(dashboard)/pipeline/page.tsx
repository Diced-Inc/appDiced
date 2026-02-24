import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { PipelineBoard } from "@/components/pipeline-board";
import { PipelineInsights } from "@/components/pipeline-insights";
import { getPipelineApps, getPipelineInsights } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { userId } = await auth();
  if (!userId) return null;

  const [apps, insights] = await Promise.all([
    getPipelineApps(userId),
    getPipelineInsights(userId),
  ]);

  return (
    <div>
      <Header title="Esteira de Produção" />
      <div className="space-y-4 p-4 md:p-6">
        <PipelineInsights insights={insights} />
        <PipelineBoard apps={apps} />
      </div>
    </div>
  );
}
