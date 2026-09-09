"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketingIntegration } from "@/lib/acquisition";
import type { CreativeResult, TrackingReport, CohortReport, CampaignHistory } from "@/lib/campaign-detail-types";
import { toBrazilDateStr } from "@/lib/date";
import { shiftDate } from "@/lib/campaign-cohorts";
import { observationSummary, observationChanges } from "@/lib/campaign-observation";
import Image from "next/image";
import { Card } from "@diced/ui/card";
import { ExternalLink } from "lucide-react";

type Section = "creatives" | "tracking" | "cohort" | "history";
type Payload = Partial<TrackingReport & CohortReport> & { creatives?: CreativeResult[]; history?: CampaignHistory[]; error?: string };
const labels: Record<Section, string> = { creatives: "Criativos", tracking: "Rastreamento", cohort: "Retorno D1 / D7 / D30", history: "Decisões e histórico" };
const statusLabels: Record<string, string> = { ACTIVE: "Ativo", PAUSED: "Pausado", CAMPAIGN_PAUSED: "Campanha pausada", ADSET_PAUSED: "Conjunto pausado", PENDING_REVIEW: "Em análise", DISAPPROVED: "Reprovado", IN_PROCESS: "Em processamento", WITH_ISSUES: "Com pendências", ARCHIVED: "Arquivado", DELETED: "Excluído" };
const button = "rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50";

/** Janela dos criativos — independente do período da página. `from`/`to` só afetam esta seção. */
const CREATIVE_RANGES = { today: "Hoje", "7d": "7 dias", all: "Tudo" } as const;
type CreativeRange = keyof typeof CREATIVE_RANGES;

function creativeWindow(key: CreativeRange): { from: string; to: string } {
  const today = toBrazilDateStr();
  const from = key === "today" ? today : key === "7d" ? shiftDate(today, -6) : shiftDate(today, -365);
  return { from, to: today };
}

export function CampaignDetails({ integration, onClose }: { integration: MarketingIntegration; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const [section, setSection] = useState<Section>("creatives");
  const [creativeRange, setCreativeRange] = useState<CreativeRange>("7d");
  const [date, setDate] = useState(shiftDate(toBrazilDateStr(), -1));
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ loading: boolean; data: Payload | null; error: string | null }>({ loading: true, data: null, error: null });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sort, setSort] = useState("spend");
  const money = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: integration.currency }).format(value);
  const number = (value: number | undefined) => (value ?? 0).toLocaleString("pt-BR");
  const endpoint = `/api/campaigns/${encodeURIComponent(integration.id)}`;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ section, date, ...creativeWindow(creativeRange) });
    fetch(`${endpoint}?${params}`, { signal: controller.signal }).then(async response => {
      const data = await response.json() as Payload;
      if (!response.ok) throw new Error(data.error || "Consulta indisponível.");
      if (!controller.signal.aborted) setState({ loading: false, data, error: null });
    }).catch(error => { if (!controller.signal.aborted) setState({ loading: false, data: null, error: error instanceof Error ? error.message : "Consulta indisponível." }); });
    return () => controller.abort();
  }, [endpoint, section, date, creativeRange, revision]);

  function reload(next: Section = section) { setState({ loading: true, data: null, error: null }); setSection(next); setRevision(n => n + 1); setSaveError(null); }
  async function save(action: "decision" | "observe") {
    setSaving(true); setSaveError(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "decision" ? { note } : { action }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      if (action === "decision") setNote(""); reload("history");
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  const data = state.data;
  const creatives = [...(data?.creatives || [])].sort((a, b) => sort === "cpi" ? (a.cpi ?? Infinity) - (b.cpi ?? Infinity) : sort === "installs" ? b.installs - a.installs : b.spend - a.spend);
  const metaUrl = (adId: string) => `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(integration.metaAdAccountId.replace(/^act_/, ""))}&selected_campaign_ids=${encodeURIComponent(integration.metaCampaignId)}&selected_ad_ids=${encodeURIComponent(adId)}`;

  return <dialog ref={dialogRef} aria-labelledby={`campaign-title-${integration.id}`} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#191923] p-0 text-zinc-100 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm">
    <Card>
    <div className="flex items-start justify-between gap-3"><div><h2 id={`campaign-title-${integration.id}`} className="text-lg font-semibold">{integration.metaCampaignName}</h2><p className="text-sm text-zinc-400">{integration.appName}</p></div><button type="button" className={button} onClick={onClose}>Fechar detalhes</button></div>
    <div className="my-4 flex flex-wrap gap-2" aria-label="Detalhes da campanha">{(Object.keys(labels) as Section[]).map(key => <button type="button" key={key} aria-pressed={section === key} onClick={() => reload(key)} className={`${button} ${section === key ? "bg-violet-500/20 text-violet-300" : "text-zinc-400"}`}>{labels[key]}</button>)}</div>
    {section === "cohort" && <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("date")); setDate(value); reload(); }}>
      <label className="text-sm text-zinc-400">Dia do primeiro acesso<input type="date" required name="date" defaultValue={date} min={shiftDate(toBrazilDateStr(), -366)} max={toBrazilDateStr()} className="ml-2 rounded border border-white/10 bg-zinc-900 p-2 text-white" /></label><button className={button}>Consultar retorno</button>
    </form>}
    {state.loading && <p role="status" className="py-6 text-zinc-400">Consultando {labels[section].toLowerCase()}…</p>}
    {state.error && <div role="alert" className="rounded bg-amber-500/10 p-3 text-sm text-amber-300">{state.error} <button className={button} onClick={() => reload()}>Tentar novamente</button></div>}
    {!state.loading && !state.error && section !== "history" && data && !data.creatives && !data.events && !data.windows &&
      <p role="status" className="py-6 text-sm text-amber-300">A consulta de {labels[section].toLowerCase()} respondeu sem dados desta seção (campos recebidos: {Object.keys(data).join(", ") || "nenhum"}). <button className={button} onClick={() => reload()}>Tentar novamente</button></p>}

    {!state.loading && section === "creatives" && data?.creatives && <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1" aria-label="Período dos criativos">
          {(Object.keys(CREATIVE_RANGES) as CreativeRange[]).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={creativeRange === key}
              onClick={() => { setCreativeRange(key); setState({ loading: true, data: null, error: null }); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${creativeRange === key ? "bg-violet-500/15 text-violet-300" : "text-zinc-400 hover:text-white"}`}
            >
              {CREATIVE_RANGES[key]}
            </button>
          ))}
        </div>
        <label className="text-sm text-zinc-400">Ordenar <select value={sort} onChange={event => setSort(event.target.value)} className="rounded-lg border border-white/10 bg-surface p-2 text-white"><option value="spend">Maior gasto</option><option value="installs">Mais instalações</option><option value="cpi">Menor CPI</option></select></label>
      </div>
      <p className="mb-3 text-xs text-zinc-500">{data.range?.from} a {data.range?.to} · Instalações atribuídas pela Meta. CPI menor não comprova ROI.</p>
      {!creatives.length && <p className="py-4 text-zinc-400">Nenhum anúncio encontrado nesta campanha.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{creatives.map(ad => <article key={ad.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        {ad.thumbnail ? <a href={metaUrl(ad.id)} target="_blank" rel="noreferrer"><Image unoptimized width={400} height={176} src={ad.thumbnail} alt={`Miniatura de ${ad.name}`} loading="lazy" referrerPolicy="no-referrer" className="h-44 w-full bg-black object-contain" /></a> : <div className="flex h-24 items-center justify-center text-sm text-zinc-500">Miniatura indisponível</div>}
        <div className="space-y-3 p-4"><h3 className="font-medium">{ad.name}</h3><p className="text-xs text-violet-300">{statusLabels[ad.status] || ad.status}</p>
          <div className="grid grid-cols-3 gap-3 text-sm">{[["Gasto", money(ad.spend)], ["Instalações", number(ad.installs)], ["CPI", money(ad.cpi)], ["Impressões", number(ad.impressions)], ["Cliques", number(ad.clicks)], ["CTR", ad.ctr === null ? "—" : `${ad.ctr.toFixed(2)}%`]].map(([label, value]) => <div key={label}><p className="text-xs text-zinc-500">{label}</p><p>{value}</p></div>)}</div>
          <details className="text-sm text-zinc-400"><summary className="cursor-pointer">Texto do anúncio</summary><p className="mt-2 whitespace-pre-wrap">{ad.title}</p><p className="mt-2 whitespace-pre-wrap">{ad.body || "Texto não disponibilizado pela Meta."}</p></details>
          <a className="block text-sm text-violet-400 hover:underline" href={metaUrl(ad.id)} target="_blank" rel="noreferrer">Ver anúncio e prévia no Meta <ExternalLink className="inline h-3.5 w-3.5 align-[-2px]" strokeWidth={1.75} aria-hidden="true" /></a>
        </div></article>)}</div>
    </>}

    {!state.loading && section === "tracking" && data?.events && <div className="space-y-4">
      <p className="text-sm text-zinc-400">Últimos 28 dias · {data.range?.from} a {data.range?.to}. Os eventos abaixo são do app inteiro; as UTMs são verificadas separadamente.</p>
      <div className="grid gap-3 md:grid-cols-3">{[["UTM da campanha", (data.utmUsers || 0) > 0 ? `${number(data.utmUsers)} primeiros acessos identificados` : "Ainda não detectada"], ["Receita de anúncios por UTM", money(data.adRevenue)], ["Receita total por UTM", money(data.totalRevenue)]].map(([title, value]) => <div className="rounded border border-white/10 p-4" key={title}><p className="text-sm text-zinc-400">{title}</p><p className="mt-2 font-medium">{value}</p></div>)}</div>
      <div className="grid gap-2 sm:grid-cols-2">{["first_open", "session_start", "ad_impression", "ad_paid", "purchase", "in_app_purchase"].map(name => { const event = data.events!.find(e => e.name === name); return <div key={name} className="rounded bg-white/5 p-3 text-sm"><p>{name} · {event ? number(event.count) : "Não observado"}</p><p className="text-xs text-zinc-400">Último dia observado: {event?.lastDate || "—"}</p></div>; })}</div>
      <p className="text-xs text-zinc-400">Ausência de evento pode indicar atraso, ausência de uso ou instrumentação pendente. ad_paid recebido não comprova valor ou moeda corretos. Receita usa métricas monetárias padrão do GA4, sem somar ad_paid. {data.thresholded && "O GA4 aplicou limites de privacidade; dados podem estar incompletos."} Fuso GA4: {data.timeZone || "não informado"}.</p>
    </div>}

    {!state.loading && section === "cohort" && data?.windows && <div className="space-y-4">
      <p className="text-sm text-zinc-400">Usuários cujo primeiro acesso ocorreu em {data.date}, com a UTM exclusiva desta campanha. Receita acumulada de D0 até D1, D7 ou D30; dias de calendário, não horas corridas.</p>
      <p>Investimento Meta no dia: <strong>{money(data.spend)}</strong></p>
      <div className="grid gap-3 md:grid-cols-3">{data.windows.map(window => <div key={window.day} className="space-y-2 rounded-xl border border-white/10 p-4"><h3 className="text-lg font-semibold">D{window.day}</h3><p className="text-xs text-violet-300">{window.complete ? "Janela encerrada · sujeita a ajustes" : "Janela em formação"} · até {window.endDate}</p><p className="text-2xl font-semibold">{money(window.revenue)}</p><p className="text-sm text-zinc-400">{number(window.users)} usuários identificados · Receita/usuário {money(window.perUser)}</p><p className="text-sm">ROAS UTM {window.complete && window.roas !== null ? `${window.roas.toFixed(2)}x` : "—"}</p>{window.users === 0 && <p className="text-xs text-amber-300">Sem usuários identificados: retorno ainda não mensurável.</p>}</div>)}</div>
      <p className="text-xs text-zinc-400">O gasto inclui toda a campanha nesse dia; a receita inclui apenas usuários com UTM exata. Não inclui o fallback genérico Facebook nem receita manual ad_paid. Fuso GA4: {data.timeZone || "não informado"}; gasto segue o fuso da conta Meta. Diferenças de fuso e atraso podem afetar a comparação. {data.thresholded && "Relatório sujeito a limites de privacidade do GA4."}</p>
    </div>}

    {section === "history" && <div className="space-y-4">
      <form onSubmit={event => { event.preventDefault(); void save("decision"); }} className="space-y-2"><label className="block text-sm text-zinc-400" htmlFor={`decision-${integration.id}`}>Decisão e motivo</label><textarea id={`decision-${integration.id}`} required maxLength={2000} value={note} onChange={event => setNote(event.target.value)} placeholder="Ex.: manter R$6/dia até validar instalações e receita." className="min-h-24 w-full rounded border border-white/10 bg-zinc-900 p-3 text-sm" /><div className="flex flex-wrap gap-2"><button disabled={saving || !note.trim()} className={button}>Registrar decisão</button><button type="button" disabled={saving} className={button} onClick={() => void save("observe")}>Registrar configuração atual</button></div></form>
      {saveError && <p role="alert" className="text-sm text-amber-300">{saveError}</p>}
      <p className="text-xs text-zinc-400">Registrar uma decisão não executa mudanças nos anúncios. Mudanças detectadas são comparações de configuração, com horário de observação; não identificam quem alterou nem o horário exato na Meta.</p>
      {data?.history?.length === 0 && <p className="text-sm text-zinc-400">Nenhum registro ainda. O histórico começa a partir desta configuração.</p>}
      {data?.history?.map((item, index) => <article key={item.id} className="rounded border-l-2 border-violet-500 bg-white/5 p-3"><p className="text-xs text-zinc-400">{new Date(item.created_at).toLocaleString("pt-BR")} · {item.kind === "decision" ? "Decisão registrada" : "Configuração observada"}</p>{item.note && <p className="mt-2 whitespace-pre-wrap text-sm">{item.note}</p>}{item.snapshot && <details className="mt-2 text-sm"><summary className="cursor-pointer">Ver status, orçamento e criativos observados</summary><ul className="mt-2 space-y-1 text-xs text-zinc-400">{[...observationChanges(data.history!.slice(index + 1).find(entry => entry.kind === "observation")?.snapshot || null, item.snapshot), ...observationSummary(item.snapshot, integration.currency)].map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</ul></details>}</article>)}
      {data?.history?.length === 100 && <p className="text-xs text-zinc-400">Mostrando os 100 registros mais recentes.</p>}
    </div>}
  </Card></dialog>;
}
