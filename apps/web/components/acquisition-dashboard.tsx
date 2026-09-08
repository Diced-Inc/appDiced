"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@diced/ui/card";
import { KpiCard } from "@diced/ui/kpi-card";
import {
  computeAcquisitionSummary,
  type AcquisitionDailyMetric,
  type MarketingIntegration,
} from "@/lib/acquisition";

import { campaignAttribution, campaignResult } from "@/lib/campaign-reporting";
import { CampaignStatus } from "@/components/campaign-status";
import type { MetaCampaign } from "@/lib/meta/ads";

interface AcquisitionDashboardProps {
  campaigns?: MetaCampaign[];
  metaUnavailable?: boolean;
  integrations: MarketingIntegration[];
  metrics: AcquisitionDailyMetric[];
  periodLabel: string;
  setupError: string | null;
}

function currency(value: number, code: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code || "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function compactCurrency(value: number, code: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code || "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function shortDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const icons = {
  spend: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
  ),
  revenue: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
  ),
  profit: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 18 6-6 4 4 9-10.5m0 0h-6m6 0v6" /></svg>
  ),
  installs: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-6L12 15m0 0 4.5-4.5M12 15V3" /></svg>
  ),
};

export function AcquisitionDashboard({ integrations, metrics: rawMetrics, periodLabel, setupError, campaigns = [], metaUnavailable = false }: AcquisitionDashboardProps) {
  const attribution = useMemo(() => campaignAttribution(rawMetrics, integrations), [rawMetrics, integrations]);
  const metrics = attribution.rows;
  const currencies = new Set(integrations.map((item) => item.currency));
  const [selectedAppId, setSelectedAppId] = useState(currencies.size <= 1 ? "all" : integrations[0]?.appId || "all");

  const selectedIntegrations = useMemo(
    () => selectedAppId === "all" ? integrations : integrations.filter((item) => item.appId === selectedAppId),
    [integrations, selectedAppId]
  );
  const selectedIds = useMemo(() => new Set(selectedIntegrations.map((item) => item.id)), [selectedIntegrations]);
  const selectedRows = useMemo(() => metrics.filter((row) => selectedIds.has(row.integrationId)), [metrics, selectedIds]);
  const summary = useMemo(() => computeAcquisitionSummary(selectedRows), [selectedRows]);
  const currencyCode = selectedIntegrations[0]?.currency || "BRL";

  const chartData = useMemo(() => {
    const days = new Map<string, { date: string; spend: number; revenue: number; profit: number }>();
    for (const row of selectedRows) {
      const day = days.get(row.date) ?? { date: row.date, spend: 0, revenue: 0, profit: 0 };
      day.spend += row.spend;
      day.revenue += row.totalRevenue;
      day.profit = day.revenue - day.spend;
      days.set(row.date, day);
    }
    return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedRows]);

  const campaignRows = useMemo(() => selectedIntegrations.map((integration) => {
    const rows = metrics.filter((row) => row.integrationId === integration.id);
    return { integration, summary: computeAcquisitionSummary(rows), missing: !!setupError || !!integration.errorMessage || attribution.duplicateUtmIds.includes(integration.id) };
  }), [selectedIntegrations, metrics, setupError, attribution.duplicateUtmIds]);

  if (setupError && integrations.length === 0) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-white">Banco ainda não preparado</h2>
        <p className="mt-2 text-sm text-zinc-400">Aplique a migration de aquisição no Supabase antes de usar esta tela.</p>
      </Card>
    );
  }

  if (integrations.length === 0) {
    return (
      <Card>
        <div className="mx-auto max-w-xl py-6 text-center md:py-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">{icons.profit}</div>
          <h2 className="mt-4 text-lg font-semibold text-white">Conecte sua primeira campanha</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Vincule o app, a campanha da Meta e o fluxo do Firebase/GA4. O painel passará a calcular gasto, receita atribuída, lucro, ROAS e custo por instalação.
          </p>
          <a href="/settings" className="mt-5 inline-flex cursor-pointer rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300">
            Vincular campanha
          </a>
        </div>
      </Card>
    );
  }

  const roasLabel = summary.roas === null ? "—" : `${summary.roas.toFixed(2)}x`;
  const utmRoasLabel = summary.utmRoas === null ? "—" : `${summary.utmRoas.toFixed(2)}x`;
  const unavailable = !!setupError || selectedIntegrations.some(i => !!i.errorMessage || attribution.duplicateUtmIds.includes(i.id));
  const resultLabel = campaignResult(summary.spend, summary.revenue, unavailable);
  const profitable = !unavailable && summary.spend > 0 && summary.profit > 0;
  const syncDates = selectedIntegrations.map(i => i.lastSync).filter((value): value is string => !!value).sort();
  const oldestSync = syncDates.length === selectedIntegrations.length ? syncDates[0] : null;
  const metadata = (integration: MarketingIntegration) => <CampaignStatus integration={integration} campaign={campaigns.find(c => c.id === integration.metaCampaignId)} ambiguous={attribution.ambiguousIds.includes(integration.id)} duplicate={attribution.duplicateUtmIds.includes(integration.id)} />;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {currencies.size <= 1 && (
            <button type="button" onClick={() => setSelectedAppId("all")} className={`min-h-9 w-full cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 sm:w-auto ${selectedAppId === "all" ? "bg-violet-500/10 text-violet-400" : "text-zinc-400 hover:text-white"}`}>Todos os apps</button>
          )}
          {integrations.filter((integration, index, all) => all.findIndex(i => i.appId === integration.appId) === index).map((integration) => (
            <button key={integration.id} type="button" onClick={() => setSelectedAppId(integration.appId)} className={`min-h-9 w-full cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 sm:w-auto ${selectedAppId === integration.appId ? "bg-violet-500/10 text-violet-400" : "text-zinc-400 hover:text-white"}`}>{integration.appName}</button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 sm:ml-auto">
          <span className={`h-2 w-2 rounded-full ${selectedIntegrations.some((item) => item.errorMessage) ? "bg-red-400" : "bg-emerald-400"}`} aria-hidden="true" />
          <span className="text-xs text-zinc-500">
            {oldestSync
              ? `Atualizado ${shortDateTime(oldestSync)}`
              : "Aguardando primeira sincronização"}
          </span>
        </div>
      </div>

      {setupError && <p role="alert" className="text-sm text-amber-300">Métricas indisponíveis. Tente sincronizar novamente.</p>}
      {metaUnavailable && <p role="status" className="text-sm text-amber-300">Não foi possível atualizar o status e orçamento na Meta. Os resultados salvos continuam disponíveis.</p>}
      {attribution.ambiguousIds.some(id => selectedIds.has(id)) && <p role="status" className="text-sm text-amber-300">Há campanhas no mesmo fluxo. Receita genérica do Facebook foi excluída dos totais para evitar atribuição duplicada. UTMs compartilhadas também são excluídas até corrigir o vínculo.</p>}
      {selectedIntegrations.some((item) => item.errorMessage) && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {selectedIntegrations.find((item) => item.errorMessage)?.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard title={`Investimento · ${periodLabel}`} value={currency(summary.spend, currencyCode)} subtitle={`${summary.impressions.toLocaleString("pt-BR")} impressões • ${summary.clicks.toLocaleString("pt-BR")} cliques`} icon={icons.spend} />
        <KpiCard title="Receita Facebook (GA4)" value={unavailable ? "—" : currency(summary.revenue, currencyCode)} subtitle={`${currency(summary.utmRevenue, currencyCode)} com UTM exata`} icon={icons.revenue} />
        <KpiCard title="Saldo após mídia (GA4)" value={unavailable ? "—" : currency(summary.profit, currencyCode)} change={unavailable ? "Atribuição indisponível" : summary.spend > 0 ? `ROAS amplo ${roasLabel} • UTM ${utmRoasLabel}` : "Sem gasto no período"} changeType={unavailable || summary.spend === 0 || summary.profit === 0 ? "neutral" : profitable ? "positive" : "negative"} icon={icons.profit} />
        <KpiCard title="Facebook no GA4" value={unavailable ? "—" : summary.ga4Installs.toLocaleString("pt-BR")} subtitle={summary.costPerInstall === null ? "Primeiras aberturas" : `Primeiras aberturas • CPI ${currency(summary.costPerInstall, currencyCode)}`} icon={icons.installs} />
      </div>

      <Card className="overflow-hidden">
        <div className="mb-3 md:mb-4">
          <h2 className="text-base font-semibold font-heading md:text-lg">Conciliação de instalações</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Compare atribuição, primeira abertura e rastreamento exato.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.02] p-3 sm:p-4">
            <p className="text-[10px] font-medium uppercase leading-4 tracking-wide text-zinc-500 sm:text-xs">Meta</p>
            <p className="mt-1 whitespace-nowrap text-xl font-semibold text-white tabular-nums sm:mt-2 sm:text-2xl">{summary.metaInstalls.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500 sm:text-xs">{summary.metaCostPerInstall === null ? "CPI —" : `CPI ${currency(summary.metaCostPerInstall, currencyCode)}`}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3 sm:p-4">
            <p className="text-[10px] font-medium uppercase leading-4 tracking-wide text-emerald-300/70 sm:text-xs">GA4 Facebook</p>
            <p className="mt-1 whitespace-nowrap text-xl font-semibold text-white tabular-nums sm:mt-2 sm:text-2xl">{summary.ga4Installs.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500 sm:text-xs">{summary.costPerInstall === null ? "CPI —" : `CPI ${currency(summary.costPerInstall, currencyCode)}`}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-3 sm:p-4">
            <p className="text-[10px] font-medium uppercase leading-4 tracking-wide text-violet-300/70 sm:text-xs">UTM exata</p>
            <p className="mt-1 whitespace-nowrap text-xl font-semibold text-white tabular-nums sm:mt-2 sm:text-2xl">{summary.utmInstalls.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-[10px] leading-4 text-zinc-500 sm:text-xs">{summary.utmCostPerInstall === null ? "CPI —" : `CPI ${currency(summary.utmCostPerInstall, currencyCode)}`}</p>
          </div>
        </div>
        <p className="mt-3 border-t border-white/5 pt-3 text-[11px] leading-4 text-zinc-500 md:text-xs">
          {summary.utmInstalls.toLocaleString("pt-BR")} com UTM completa + {summary.facebookReferralInstalls.toLocaleString("pt-BR")} identificadas pelo fallback nativo do Facebook (fb4a).
        </p>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold font-heading md:text-lg">Gasto x receita atribuída</h2>
            <p className="mt-1 text-xs text-zinc-500">Receita atribuída por UTM e estimativa Facebook para fluxos com uma única campanha. Valores indisponíveis não comprovam ausência de receita.</p>
          </div>
          <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${profitable ? "bg-emerald-500/10 text-emerald-400" : unavailable || summary.spend === 0 || summary.profit === 0 ? "bg-white/5 text-zinc-400" : "bg-red-500/10 text-red-400"}`}>
            {resultLabel}
          </span>
        </div>
        <div className="h-[240px] min-w-0 w-full sm:h-[260px] md:h-[340px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 800, height: 340 }}>
            <ComposedChart data={unavailable ? [] : chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickFormatter={(value: string) => { const date = new Date(`${value}T12:00:00`); return `${date.getDate()}/${date.getMonth() + 1}`; }} />
              <YAxis stroke="#71717a" fontSize={12} tickFormatter={(value: number) => compactCurrency(value, currencyCode)} width={66} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1B1B26", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#fff" }}
                formatter={(value, name) => [currency(Number(value ?? 0), currencyCode), name === "spend" ? "Gasto" : name === "revenue" ? "Receita" : "Lucro"]}
                labelFormatter={(label) => new Date(`${String(label)}T12:00:00`).toLocaleDateString("pt-BR")}
              />
              <Legend formatter={(value) => value === "spend" ? "Gasto" : value === "revenue" ? "Receita" : "Lucro"} />
              <Bar dataKey="spend" fill="#F87171" fillOpacity={0.72} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="revenue" fill="#34D399" fillOpacity={0.72} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Line type="monotone" dataKey="profit" stroke="#A78BFA" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold font-heading md:text-lg">Resultado por campanha</h2>
            <p className="mt-1 text-xs text-zinc-500">Meta, GA4 e UTM são exibidos separadamente para evitar um CPI enganoso.</p>
          </div>
          <a href="/settings" className="cursor-pointer text-xs font-medium text-violet-400 transition-colors hover:text-violet-300">Configurar</a>
        </div>
        <div className="grid gap-3 lg:hidden">
          {campaignRows.map(({ integration, summary: row, missing }) => (
            <div key={integration.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="min-w-0 border-b border-white/5 pb-3">
                <p className="truncate text-sm font-medium text-white">{integration.metaCampaignName}</p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500">{integration.appName} • {integration.utmCampaign}</p>{metadata(integration)}
              </div>
              <div className="grid grid-cols-3 gap-2 py-3">
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Gasto</p><p className="mt-1 whitespace-nowrap text-sm font-medium text-zinc-200 tabular-nums">{currency(row.spend, integration.currency)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Receita</p><p className="mt-1 whitespace-nowrap text-sm font-medium text-zinc-200 tabular-nums">{missing ? "—" : currency(row.revenue, integration.currency)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Lucro</p><p className={`mt-1 whitespace-nowrap text-sm font-medium tabular-nums ${missing || row.spend === 0 || row.profit === 0 ? "text-zinc-400" : row.profit > 0 ? "text-emerald-400" : "text-red-400"}`}>{missing ? "—" : currency(row.profit, integration.currency)}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-y border-white/5 py-3">
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">ROAS GA4</p><p className="mt-1 text-sm font-medium text-zinc-200 tabular-nums">{missing || row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">CPI GA4</p><p className="mt-1 text-sm font-medium text-zinc-200 tabular-nums">{missing || row.costPerInstall === null ? "—" : currency(row.costPerInstall, integration.currency)}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">Meta</p><p className="mt-1 text-sm font-semibold text-white tabular-nums">{row.metaInstalls.toLocaleString("pt-BR")}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">GA4</p><p className="mt-1 text-sm font-semibold text-white tabular-nums">{row.ga4Installs.toLocaleString("pt-BR")}</p></div>
                <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">UTM</p><p className="mt-1 text-sm font-semibold text-white tabular-nums">{row.utmInstalls.toLocaleString("pt-BR")}</p></div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-white/5 text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="pb-3 font-medium">Campanha</th><th className="pb-3 text-right font-medium">Gasto</th><th className="pb-3 text-right font-medium">Receita GA4</th><th className="pb-3 text-right font-medium">Receita UTM</th><th className="pb-3 text-right font-medium">Saldo após mídia</th><th className="pb-3 text-right font-medium">ROAS GA4</th><th className="pb-3 text-right font-medium">Meta</th><th className="pb-3 text-right font-medium">GA4 Facebook</th><th className="pb-3 text-right font-medium">UTM exata</th><th className="pb-3 text-right font-medium">CPI GA4</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaignRows.map(({ integration, summary: row, missing }) => (
                <tr key={integration.id}>
                  <td className="py-3 pr-4"><p className="font-medium text-white">{integration.metaCampaignName}</p><p className="mt-0.5 text-xs text-zinc-500">{integration.appName} • {integration.utmCampaign}</p></td>
                  <td className="py-3 text-right text-zinc-300">{currency(row.spend, integration.currency)}</td>
                  <td className="py-3 text-right text-zinc-300">{missing ? "—" : currency(row.revenue, integration.currency)}</td>
                  <td className="py-3 text-right text-zinc-300">{missing ? "—" : currency(row.utmRevenue, integration.currency)}</td>
                  <td className={`py-3 text-right font-medium ${missing || row.spend === 0 || row.profit === 0 ? "text-zinc-400" : row.profit > 0 ? "text-emerald-400" : "text-red-400"}`}>{missing ? "—" : currency(row.profit, integration.currency)}</td>
                  <td className="py-3 text-right text-zinc-300">{missing || row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}</td>
                  <td className="py-3 text-right text-zinc-300">{row.metaInstalls.toLocaleString("pt-BR")}</td>
                  <td className="py-3 text-right text-zinc-300">{row.ga4Installs.toLocaleString("pt-BR")}</td>
                  <td className="py-3 text-right text-zinc-300">{row.utmInstalls.toLocaleString("pt-BR")}</td>
                  <td className="py-3 text-right text-zinc-300">{missing || row.costPerInstall === null ? "—" : currency(row.costPerInstall, integration.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-zinc-500">
        Receita GA4 = UTM configurada + fallback apps.facebook.com / fb4a. A receita genérica não identifica uma campanha e só entra nos totais quando o fluxo tem um único vínculo. Em fluxos compartilhados, são usadas apenas UTMs exclusivas. O painel revisa os últimos 14 dias a cada coleta e 90 dias diariamente.
      </p>
    </div>
  );
}
