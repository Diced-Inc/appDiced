import type { MetaCampaign } from "@/lib/meta/ads";
import type { MarketingIntegration } from "@/lib/acquisition";
import { CampaignToggle } from "@/components/campaign-toggle";
import { ChevronRight, ExternalLink } from "lucide-react";

const statuses: Record<string, string> = { ACTIVE: "Ativa", PAUSED: "Pausada", ARCHIVED: "Arquivada", DELETED: "Excluída", IN_PROCESS: "Em processamento", PENDING_REVIEW: "Em análise", DISAPPROVED: "Reprovada", WITH_ISSUES: "Com pendências" };

export function CampaignStatus({ integration, campaign, ambiguous, duplicate, onDetails }: { integration: MarketingIntegration; campaign?: MetaCampaign; ambiguous: boolean; duplicate: boolean; onDetails: () => void }) {
  // These accounts use the API's hundredths-of-currency budget convention.
  const supportedCurrency = ["BRL", "USD", "EUR", "GBP"].includes(integration.currency);
  const amount = Number(campaign?.dailyBudget) > 0 ? campaign?.dailyBudget : campaign?.lifetimeBudget;
  const budget = amount && Number(amount) > 0 && supportedCurrency
    ? `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: integration.currency }).format(Number(amount) / 100)}${Number(campaign?.dailyBudget) > 0 ? "/dia" : " total"}`
    : campaign ? "Orçamento: consultar Meta" : "Orçamento indisponível";
  const status = campaign ? statuses[campaign.effectiveStatus] || statuses[campaign.status] || "Status indisponível" : "Status indisponível";
  const tone = campaign?.effectiveStatus === "ACTIVE" ? "bg-emerald-400/10 text-emerald-300" : campaign?.status === "PAUSED" ? "bg-amber-400/10 text-amber-300" : "bg-white/5 text-zinc-300";
  return <div className="mt-2.5 space-y-2.5 text-xs text-zinc-400">
    <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span><span className="text-[11px] tabular-nums">{budget}</span></div>
    {integration.errorMessage && <p className="text-amber-300">Falha na sincronização</p>}
    {!integration.lastSync && <p>Aguardando sincronização</p>}
    {ambiguous && <p className="text-amber-300">Receita genérica do Facebook excluída desta campanha.</p>}
    {duplicate && <p className="text-amber-300">UTM compartilhada: resultado indisponível até corrigir o vínculo.</p>}
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={onDetails} title="Criativos, rastreamento e histórico" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-transparent px-2.5 text-[11px] font-medium text-zinc-200 transition-colors duration-150 hover:border-violet-300/40 hover:text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">Ver detalhes <ChevronRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /></button>
      <CampaignToggle key={`${integration.id}:${campaign?.status}`} id={integration.id} name={integration.metaCampaignName} status={campaign?.status} />
      <a className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[11px] text-zinc-400 transition-colors duration-150 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400" aria-label={`Abrir ${integration.metaCampaignName} na Meta`} href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(integration.metaAdAccountId.replace(/^act_/, ""))}&selected_campaign_ids=${encodeURIComponent(integration.metaCampaignId)}`} target="_blank" rel="noreferrer">Meta <ExternalLink className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /></a>
    </div>
    <details className="text-[10px] text-zinc-500"><summary className="w-fit cursor-pointer hover:text-zinc-300">{integration.lastSync ? `Sync ${new Date(integration.lastSync).toLocaleTimeString("pt-BR", { timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit" })}` : "Informações de atribuição"}</summary><div className="mt-1 max-w-xs space-y-1 break-words"><p>UTM: {integration.utmCampaign}</p><p>Integração conectada · atribuição depende dos eventos.</p>{integration.lastSync && <p>Atualizado em {new Date(integration.lastSync).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p>}</div></details>
  </div>;
}
