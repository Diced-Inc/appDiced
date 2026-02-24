import { auth } from "@clerk/nextjs/server";
import { Header } from "@/components/header";
import { PipelineBoard } from "@/components/pipeline-board";
import { getPipelineApps } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { userId } = await auth();
  if (!userId) return null;

  const apps = await getPipelineApps(userId);

  return (
    <div>
      <Header title="Esteira de Produção" />
      <div className="p-4 md:p-6">
        <PipelineBoard apps={apps} />
      </div>
    </div>
  );
}
