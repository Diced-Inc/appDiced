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

interface AcquisitionDashboardProps {
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

export function AcquisitionDashboard({ integrations, metrics, periodLabel, setupError }: AcquisitionDashboardProps) {
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
    return { integration, summary: computeAcquisitionSummary(rows) };
  }), [selectedIntegrations, metrics]);

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
            Configurar aquisição
          </a>
        </div>
      </Card>
    );
  }

  const roasLabel = summary.roas === null ? "—" : `${summary.roas.toFixed(2)}x`;
  const utmRoasLabel = summary.utmRoas === null ? "—" : `${summary.utmRoas.toFixed(2)}x`;
  const profitable = summary.profit >= 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {currencies.size <= 1 && (
          <button type="button" onClick={() => setSelectedAppId("all")} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${selectedAppId === "all" ? "bg-violet-500/10 text-violet-400" : "text-zinc-400 hover:text-white"}`}>Todos os apps</button>
        )}
        {integrations.map((integration) => (
          <button key={integration.id} type="button" onClick={() => setSelectedAppId(integration.appId)} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${selectedAppId === integration.appId ? "bg-violet-500/10 text-violet-400" : "text-zinc-400 hover:text-white"}`}>{integration.appName}</button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${selectedIntegrations.some((item) => item.errorMessage) ? "bg-red-400" : "bg-emerald-400"}`} aria-hidden="true" />
          <span className="text-xs text-zinc-500">
            {selectedIntegrations[0]?.lastSync
              ? `Atualizado ${new Date(selectedIntegrations[0].lastSync!).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}`
              : "Aguardando primeira sincronização"}
          </span>
        </div>
      </div>

      {selectedIntegrations.some((item) => item.errorMessage) && (
        <div role="alert" className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {selectedIntegrations.find((item) => item.errorMessage)?.errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard title={`Investimento (${periodLabel})`} value={currency(summary.spend, currencyCode)} subtitle={`${summary.impressions.toLocaleString("pt-BR")} impressões • ${summary.clicks.toLocaleString("pt-BR")} cliques`} icon={icons.spend} />
        <KpiCard title="Receita Facebook (GA4)" value={currency(summary.revenue, currencyCode)} subtitle={`${currency(summary.utmRevenue, currencyCode)} com UTM exata`} icon={icons.revenue} />
        <KpiCard title="Lucro Facebook (GA4)" value={currency(summary.profit, currencyCode)} change={summary.spend > 0 ? `ROAS amplo ${roasLabel} • UTM ${utmRoasLabel}` : "Sem gasto no período"} changeType={profitable ? "positive" : "negative"} icon={icons.profit} />
        <KpiCard title="Facebook confirmado no GA4" value={summary.ga4Installs.toLocaleString("pt-BR")} subtitle={summary.costPerInstall === null ? "CPI ainda indisponível" : `CPI ${currency(summary.costPerInstall, currencyCode)}`} icon={icons.installs} />
      </div>

      <Card>
        <div className="mb-4">
          <h2 className="text-base font-semibold font-heading md:text-lg">Conciliação de instalações</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Cada plataforma responde a uma pergunta diferente. A Meta atribui o resultado ao anúncio; o GA4 confirma a primeira abertura e separa o que chegou com ou sem a UTM completa.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Meta atribuídas</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.metaInstalls.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-xs text-zinc-500">{summary.metaCostPerInstall === null ? "CPI indisponível" : `CPI ${currency(summary.metaCostPerInstall, currencyCode)}`}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/70">Facebook no GA4</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.ga4Installs.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-xs text-zinc-500">UTM exata + apps.facebook.com / fb4a</p>
          </div>
          <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.04] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-violet-300/70">UTM exata</p>
            <p className="mt-2 text-2xl font-semibold text-white">{summary.utmInstalls.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-xs text-zinc-500">{summary.utmCostPerInstall === null ? "CPI indisponível" : `CPI ${currency(summary.utmCostPerInstall, currencyCode)}`}</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold font-heading md:text-lg">Gasto x receita atribuída</h2>
            <p className="mt-1 text-xs text-zinc-500">Receita da UTM exata somada ao fallback identificado pelo GA4 como apps.facebook.com / fb4a.</p>
          </div>
          <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${profitable ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            {profitable ? "Operação positiva" : "Abaixo do break-even"}
          </span>
        </div>
        <div className="h-[260px] w-full md:h-[340px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-white/5 text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="pb-3 font-medium">Campanha</th><th className="pb-3 text-right font-medium">Gasto</th><th className="pb-3 text-right font-medium">Receita GA4</th><th className="pb-3 text-right font-medium">Receita UTM</th><th className="pb-3 text-right font-medium">Lucro GA4</th><th className="pb-3 text-right font-medium">ROAS GA4</th><th className="pb-3 text-right font-medium">Meta</th><th className="pb-3 text-right font-medium">GA4 Facebook</th><th className="pb-3 text-right font-medium">UTM exata</th><th className="pb-3 text-right font-medium">CPI GA4</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {campaignRows.map(({ integration, summary: row }) => (
                <tr key={integration.id}>
                  <td className="py-3 pr-4"><p className="font-medium text-white">{integration.metaCampaignName}</p><p className="mt-0.5 text-xs text-zinc-500">{integration.appName} • {integration.utmCampaign}</p></td>
                  <td className="py-3 text-right text-zinc-300">{currency(row.spend, integration.currency)}</td>
                  <td className="py-3 text-right text-zinc-300">{currency(row.revenue, integration.currency)}</td>
                  <td className="py-3 text-right text-zinc-300">{currency(row.utmRevenue, integration.currency)}</td>
                  <td className={`py-3 text-right font-medium ${row.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{currency(row.profit, integration.currency)}</td>
                  <td className="py-3 text-right text-zinc-300">{row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}</td>
                  <td className="py-3 text-right text-zinc-300">{row.metaInstalls.toLocaleString("pt-BR")}</td>
                  <td className="py-3 text-right text-zinc-300">{row.ga4Installs.toLocaleString("pt-BR")}</td>
                  <td className="py-3 text-right text-zinc-300">{row.utmInstalls.toLocaleString("pt-BR")}</td>
                  <td className="py-3 text-right text-zinc-300">{row.costPerInstall === null ? "—" : currency(row.costPerInstall, integration.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-zinc-500">
        Receita GA4 = UTM configurada + fallback apps.facebook.com / fb4a. A receita UTM permanece disponível como cenário conservador. O painel revisa os últimos 14 dias a cada coleta e 90 dias diariamente.
      </p>
    </div>
  );
}
