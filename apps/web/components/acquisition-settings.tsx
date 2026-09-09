"use client";

import { useMemo, useState } from "react";
import type { MarketingIntegration } from "@/lib/acquisition";
import type { GA4AndroidStream } from "@/lib/google/analytics";
import type { MetaAdAccount, MetaCampaign } from "@/lib/meta/ads";

interface AppOption {
  id: string;
  name: string;
  packageName: string;
}

interface AcquisitionSettingsProps {
  apps: AppOption[];
  accounts: MetaAdAccount[];
  campaigns: MetaCampaign[];
  streams: GA4AndroidStream[];
  integrations: MarketingIntegration[];
  metaConnected: boolean;
  googleConnected: boolean;
  metaConfigured: boolean;
  googleAuthUrl: string | null;
}

function defaultCampaign(packageName: string): string {
  if (packageName === "com.lovemessage.app") return "lovemessage_app_br_installs";
  const parts = packageName.split(".").filter(Boolean);
  const app = (parts.at(-1) === "app" ? parts.at(-2) : parts.at(-1)) || "app";
  return `${app.toLowerCase()}_app_installs`;
}

export function AcquisitionSettings({
  apps,
  accounts,
  campaigns,
  streams,
  integrations,
  metaConnected,
  googleConnected,
  metaConfigured,
  googleAuthUrl,
}: AcquisitionSettingsProps) {
  const firstApp = apps[0];
  const initialIntegration = integrations.find((item) => item.appId === firstApp?.id);
  const [appId, setAppId] = useState(initialIntegration?.appId || firstApp?.id || "");
  const [accountId, setAccountId] = useState(initialIntegration?.metaAdAccountId || accounts[0]?.id || "");
  const [campaignId, setCampaignId] = useState(initialIntegration?.metaCampaignId || "");
  const [propertyId, setPropertyId] = useState(initialIntegration?.ga4PropertyId || "");
  const [streamId, setStreamId] = useState(initialIntegration?.ga4StreamId || "");
  const [utmSource, setUtmSource] = useState(initialIntegration?.utmSource || "meta");
  const [utmMedium, setUtmMedium] = useState(initialIntegration?.utmMedium || "paid_social");
  const [utmCampaign, setUtmCampaign] = useState(
    initialIntegration?.utmCampaign || (firstApp ? defaultCampaign(firstApp.packageName) : "")
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedApp = apps.find((app) => app.id === appId);
  const filteredCampaigns = campaigns.filter((campaign) => campaign.accountId === accountId);
  const filteredStreams = streams.filter((stream) => stream.packageName === selectedApp?.packageName);
  const configuredIds = useMemo(() => new Set(integrations.map((item) => item.appId)), [integrations]);

  function chooseApp(nextAppId: string) {
    const app = apps.find((item) => item.id === nextAppId);
    const integration = integrations.find((item) => item.appId === nextAppId);
    setAppId(nextAppId);
    setAccountId(integration?.metaAdAccountId || accounts[0]?.id || "");
    setCampaignId(integration?.metaCampaignId || "");
    setPropertyId(integration?.ga4PropertyId || "");
    setStreamId(integration?.ga4StreamId || "");
    setUtmSource(integration?.utmSource || "meta");
    setUtmMedium(integration?.utmMedium || "paid_social");
    setUtmCampaign(integration?.utmCampaign || (app ? defaultCampaign(app.packageName) : ""));
    setMessage(null);
  }

  function chooseStream(value: string) {
    const stream = streams.find((item) => `${item.propertyId}:${item.streamId}` === value);
    setPropertyId(stream?.propertyId || "");
    setStreamId(stream?.streamId || "");
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/acquisition/integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId,
          metaAdAccountId: accountId,
          metaCampaignId: campaignId,
          ga4PropertyId: propertyId,
          ga4StreamId: streamId,
          utmSource,
          utmMedium,
          utmCampaign,
        }),
      });
      const body = (await response.json()) as { error?: string; sync?: { errors?: string[] } };
      if (!response.ok) throw new Error(body.error || "Não foi possível salvar a integração.");
      const syncWarning = body.sync && "errors" in body.sync && body.sync.errors?.[0];
      setMessage({
        type: syncWarning ? "error" : "success",
        text: syncWarning ? `Configuração salva, mas a coleta avisou: ${syncWarning}` : "Configuração salva e dados sincronizados.",
      });
      if (!syncWarning) setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  const canSave = Boolean(
    appId && accountId && campaignId && propertyId && streamId && utmSource && utmMedium && utmCampaign
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold font-heading md:text-lg">Campanhas</h2>
          <p className="mt-1 max-w-2xl text-xs text-zinc-400 md:text-sm">
            Cruza o gasto da campanha na Meta com instalações e receita atribuída no Firebase/GA4.
          </p>
        </div>
        {integrations.length > 0 && (
          <span className="w-fit rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            {integrations.length} app{integrations.length === 1 ? "" : "s"} monitorado{integrations.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-black/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Meta Ads</p>
              <p className="mt-0.5 text-xs text-zinc-500">Gasto, cliques e entrega</p>
            </div>
            {metaConnected ? (
              <div className="text-right"><span className="text-xs font-medium text-emerald-400">Conectado</span><a href="/api/auth/meta" className="mt-1 block text-xs text-violet-300 hover:underline">Autorizar pausa e reativação</a></div>
            ) : metaConfigured ? (
              <a href="/api/auth/meta" className="cursor-pointer rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-300 transition-colors hover:bg-blue-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
                Conectar Meta
              </a>
            ) : (
              <span className="text-xs text-amber-400">Faltam variáveis Meta</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-black/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Firebase / GA4</p>
              <p className="mt-0.5 text-xs text-zinc-500">Origem, instalações e receita</p>
            </div>
            {googleConnected && streams.length > 0 ? (
              <span className="text-xs font-medium text-emerald-400">Autorizado</span>
            ) : googleAuthUrl ? (
              <a href={googleAuthUrl} className="cursor-pointer rounded-lg bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
                {googleConnected ? "Reautorizar" : "Conectar Google"}
              </a>
            ) : (
              <span className="text-xs text-amber-400">OAuth não configurado</span>
            )}
          </div>
        </div>
      </div>

      {apps.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-medium text-zinc-400">
            Aplicativo
            <select value={appId} onChange={(event) => chooseApp(event.target.value)} className="mt-1.5 w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500">
              {apps.map((app) => (
                <option key={app.id} value={app.id}>{app.name}{configuredIds.has(app.id) ? " • configurado" : ""}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-zinc-400">
            Conta de anúncios
            <select
              value={accountId}
              onChange={(event) => { setAccountId(event.target.value); setCampaignId(""); }}
              disabled={!metaConnected}
              className="mt-1.5 w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-violet-500"
            >
              <option value="">Selecione</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>)}
            </select>
          </label>

          <label className="text-xs font-medium text-zinc-400">
            Campanha da Meta
            <select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} disabled={!accountId} className="mt-1.5 w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-violet-500">
              <option value="">Selecione</option>
              {filteredCampaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} • {campaign.effectiveStatus}</option>)}
            </select>
          </label>

          <label className="text-xs font-medium text-zinc-400">
            App no Firebase / GA4
            <select value={propertyId && streamId ? `${propertyId}:${streamId}` : ""} onChange={(event) => chooseStream(event.target.value)} disabled={!googleConnected} className="mt-1.5 w-full cursor-pointer rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-violet-500">
              <option value="">Selecione</option>
              {filteredStreams.map((stream) => <option key={`${stream.propertyId}:${stream.streamId}`} value={`${stream.propertyId}:${stream.streamId}`}>{stream.propertyName} • {stream.streamName}</option>)}
            </select>
            {googleConnected && filteredStreams.length === 0 && (
              <span className="mt-1 block font-normal text-amber-400">Nenhum fluxo Android do GA4 encontrado para {selectedApp?.packageName}.</span>
            )}
          </label>

          <label className="text-xs font-medium text-zinc-400">
            UTM source
            <input value={utmSource} onChange={(event) => setUtmSource(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" />
          </label>

          <label className="text-xs font-medium text-zinc-400">
            UTM medium
            <input value={utmMedium} onChange={(event) => setUtmMedium(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" />
          </label>

          <label className="text-xs font-medium text-zinc-400 md:col-span-2">
            UTM campaign exata usada no link do anúncio
            <input value={utmCampaign} onChange={(event) => setUtmCampaign(event.target.value)} placeholder="lovemessage_app_br_installs" className="mt-1.5 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-violet-500" />
          </label>
        </div>
      )}

      <div className="mt-5 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={save}
          disabled={!canSave || saving}
          className="cursor-pointer rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
        >
          {saving ? "Salvando e sincronizando..." : "Salvar e sincronizar"}
        </button>
        {message && <p role="status" className={`text-xs ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        A receita é filtrada pelo primeiro acesso do usuário com essas UTMs. Reconecte o Google uma vez após esta atualização para liberar a permissão de leitura do GA4.
      </p>
    </div>
  );
}
