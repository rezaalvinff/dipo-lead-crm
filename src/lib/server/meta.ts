import "server-only";
import { createHash } from "node:crypto";
import { decrypt, encrypt } from "./auth";
import { kvGet, kvSet, sql, uid } from "./db";
import { GRAPH } from "./whatsapp";
import type { Lead } from "../types";

export interface MetaConfig {
  token?: string; // terenkripsi
  tokenExpiresAt?: number;
  userName?: string;
  adAccountId?: string;
  adAccountName?: string;
  datasetId?: string;
  datasetName?: string;
  autoSend: boolean;
  ctwaEventName: string;
  crmEventName: string;
  testEventCode?: string;
}

export const defaultMetaConfig = (): MetaConfig => ({ autoSend: true, ctwaEventName: "LeadSubmitted", crmEventName: "Lead" });

export const metaAppConfigured = () => Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);

export async function getMetaConfig(): Promise<MetaConfig> {
  return { ...defaultMetaConfig(), ...((await kvGet<MetaConfig>("meta")) ?? {}) };
}
export async function saveMetaConfig(patch: Partial<MetaConfig>) {
  await kvSet("meta", { ...(await getMetaConfig()), ...patch });
}

async function token(): Promise<string | null> {
  if (process.env.META_ACCESS_TOKEN) return process.env.META_ACCESS_TOKEN;
  const c = await getMetaConfig();
  return c.token ? decrypt(c.token) : null;
}

async function graphGet(path: string, params: Record<string, string> = {}) {
  const t = await token();
  if (!t) throw new Error("Akun Meta belum terhubung");
  const qs = new URLSearchParams({ ...params, access_token: t });
  const res = await fetch(`${GRAPH()}/${path}?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`Meta API ${res.status}: ${json?.error?.message ?? ""}`);
  return json;
}

// ---------- OAuth (Facebook Login for Business) ----------

export function loginUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({ client_id: process.env.META_APP_ID!, redirect_uri: redirectUri, state, response_type: "code" });
  if (process.env.META_LOGIN_CONFIG_ID) p.set("config_id", process.env.META_LOGIN_CONFIG_ID);
  else p.set("scope", "ads_read,ads_management,business_management");
  return `https://www.facebook.com/${process.env.GRAPH_API_VERSION || "v23.0"}/dialog/oauth?${p}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const base = { client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET! };
  const short = await fetch(`${GRAPH()}/oauth/access_token?${new URLSearchParams({ ...base, redirect_uri: redirectUri, code })}`).then((r) => r.json());
  if (!short.access_token) throw new Error(short?.error?.message ?? "Gagal menukar kode login");
  const long = await fetch(`${GRAPH()}/oauth/access_token?${new URLSearchParams({ ...base, grant_type: "fb_exchange_token", fb_exchange_token: short.access_token })}`).then((r) => r.json());
  const access = long.access_token ?? short.access_token;
  const me = await fetch(`${GRAPH()}/me?fields=name&access_token=${access}`).then((r) => r.json());
  await saveMetaConfig({ token: encrypt(access), tokenExpiresAt: long.expires_in ? Date.now() + long.expires_in * 1000 : undefined, userName: me.name });
}

export async function disconnect() {
  await saveMetaConfig({ token: undefined, tokenExpiresAt: undefined, userName: undefined });
}

export async function listAdAccounts() {
  const r = await graphGet("me/adaccounts", { fields: "id,name,currency,account_status", limit: "100" });
  return (r.data ?? []) as { id: string; name: string; currency: string }[];
}

export async function listDatasets(adAccountId: string) {
  const r = await graphGet(`${adAccountId}/adspixels`, { fields: "id,name", limit: "100" });
  return (r.data ?? []) as { id: string; name: string }[];
}

// ---------- Insights (hasil iklan) ----------

export interface CampaignResult {
  campaignId: string; campaignName: string; spend: number; impressions: number; clicks: number;
  conversations: number; adIds: string[]; leads: number; warm: number;
}

export async function syncInsights(datePreset = "last_30d") {
  const c = await getMetaConfig();
  if (!c.adAccountId) throw new Error("Pilih ad account dulu");
  const rows: Record<string, string | { action_type: string; value: string }[]>[] = [];
  let r = await graphGet(`${c.adAccountId}/insights`, { level: "ad", date_preset: datePreset, limit: "500", fields: "ad_id,campaign_id,campaign_name,spend,impressions,clicks,actions" });
  rows.push(...(r.data ?? []));
  while (r.paging?.next && rows.length < 5000) { r = await fetch(r.paging.next).then((x) => x.json()); rows.push(...(r.data ?? [])); }

  const byCampaign = new Map<string, CampaignResult>();
  for (const row of rows) {
    const id = row.campaign_id as string;
    const cur = byCampaign.get(id) ?? { campaignId: id, campaignName: row.campaign_name as string, spend: 0, impressions: 0, clicks: 0, conversations: 0, adIds: [], leads: 0, warm: 0 };
    cur.spend += Number(row.spend ?? 0);
    cur.impressions += Number(row.impressions ?? 0);
    cur.clicks += Number(row.clicks ?? 0);
    const acts = (row.actions as { action_type: string; value: string }[] | undefined) ?? [];
    cur.conversations += Number(acts.find((a) => a.action_type.includes("messaging_conversation_started"))?.value ?? 0);
    cur.adIds.push(row.ad_id as string);
    byCampaign.set(id, cur);
  }
  // Gabungkan dengan data CRM: lead dari CTWA menyimpan ad_id (referral.source_id).
  const leads = await sql()`select ad_id, name, city, unit from leads where ad_id is not null`;
  for (const camp of byCampaign.values()) {
    const ls = leads.filter((l) => camp.adIds.includes(l.adId as string));
    camp.leads = ls.length;
    camp.warm = ls.filter((l) => l.name && l.city && l.unit).length;
  }
  const result = { syncedAt: Date.now(), datePreset, campaigns: [...byCampaign.values()].sort((a, b) => b.spend - a.spend) };
  await kvSet("meta_insights", result);
  return result;
}

// ---------- Conversions API ----------

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Kirim event lead WARM ke Meta. Dipanggil otomatis saat lead menjadi WARM (jika autoSend aktif) dan oleh cron retry. */
export async function sendLeadEvent(lead: Lead, opts: { force?: boolean } = {}) {
  const c = await getMetaConfig();
  const datasetId = process.env.META_DATASET_ID || c.datasetId;
  if (!datasetId || !(opts.force || c.autoSend)) return { skipped: true as const };
  const t = process.env.META_CAPI_TOKEN || (await token());
  if (!t) return { skipped: true as const };

  const phone = lead.phone.replace(/\D/g, "");
  const ctwa = Boolean(lead.ctwaClid && process.env.WHATSAPP_WABA_ID);
  const eventName = ctwa ? c.ctwaEventName : c.crmEventName;
  const event = ctwa
    ? {
        event_name: eventName, event_time: Math.floor(Date.now() / 1000), event_id: lead.id,
        action_source: "business_messaging", messaging_channel: "whatsapp",
        user_data: { whatsapp_business_account_id: process.env.WHATSAPP_WABA_ID, ctwa_clid: lead.ctwaClid },
      }
    : {
        event_name: eventName, event_time: Math.floor(Date.now() / 1000), event_id: lead.id,
        action_source: "system_generated",
        user_data: { ph: [sha(phone)], ...(lead.city ? { ct: [sha(lead.city.toLowerCase().replace(/[^a-z]/g, ""))] } : {}), country: [sha("id")] },
        custom_data: { lead_event_source: "DIPO Lead CRM", event_source: "crm", content_name: lead.unit ?? undefined },
      };

  const body: Record<string, unknown> = { data: [event] };
  if (c.testEventCode) body.test_event_code = c.testEventCode;
  const res = await fetch(`${GRAPH()}/${datasetId}/events?access_token=${encodeURIComponent(t)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  const db = sql();
  await db`insert into capi_events ${db({ id: uid(), leadId: lead.id, eventName, at: Date.now(), ok: res.ok, response: text.slice(0, 500) })}`;
  await db`update leads set capi_status = ${res.ok ? "sent" : "failed"}, capi_sent_at = ${Date.now()} where id = ${lead.id}`;
  return { ok: res.ok, response: text };
}
