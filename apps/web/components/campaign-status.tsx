import type { MetaCampaign } from "@/lib/meta/ads";
import type { MarketingIntegration } from "@/lib/acquisition";

const statuses: Record<string, string> = { ACTIVE: "Ativa", PAUSED: "Pausada", ARCHIVED: "Arquivada", DELETED: "Excluída", IN_PROCESS: "Em processamento", PENDING_REVIEW: "Em análise", DISAPPROVED: "Reprovada", WITH_ISSUES: "Com pendências" };

export function CampaignStatus({ integration, campaign, ambiguous, duplicate }: { integration: MarketingIntegration; campaign?: MetaCampaign; ambiguous: boolean; duplicate: boolean }) {
  // These accounts use the API's hundredths-of-currency budget convention.
  const supportedCurrency = ["BRL", "USD", "EUR", "GBP"].includes(integration.currency);
  const amount = Number(campaign?.dailyBudget) > 0 ? campaign?.dailyBudget : campaign?.lifetimeBudget;
  const budget = amount && Number(amount) > 0 && supportedCurrency
    ? `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: integration.currency }).format(Number(amount) / 100)}${Number(campaign?.dailyBudget) > 0 ? "/dia" : " total"}`
    : campaign ? "Orçamento: consultar Meta" : "Orçamento indisponível";
  const status = campaign ? statuses[campaign.effectiveStatus] || statuses[campaign.status] || "Status indisponível" : "Status indisponível";
  return <div className="mt-2 space-y-1 text-xs text-zinc-400">
    <p><span className="rounded bg-white/5 px-2 py-1 text-zinc-200">{status}</span> · {budget}</p>
    <p>{integration.errorMessage ? "Falha na sincronização" : !integration.lastSync ? "Aguardando sincronização" : "Integração conectada · atribuição depende dos eventos"}</p>
    {integration.lastSync && <p>Dados sincronizados: {new Date(integration.lastSync).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p>}
    {ambiguous && <p className="text-amber-300">Receita genérica do Facebook excluída desta campanha.</p>}
    {duplicate && <p className="text-amber-300">UTM compartilhada: resultado indisponível até corrigir o vínculo.</p>}
    <a className="inline-block py-1 text-violet-400 hover:underline" href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(integration.metaAdAccountId.replace(/^act_/, ""))}&selected_campaign_ids=${encodeURIComponent(integration.metaCampaignId)}`} target="_blank" rel="noreferrer">Abrir no Meta ↗</a>
  </div>;
}
