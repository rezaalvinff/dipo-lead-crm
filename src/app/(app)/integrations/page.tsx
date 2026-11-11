"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, CheckCircle2, Copy, Database, ExternalLink, Facebook, Loader2, MessageCircle, RefreshCw, Send, XCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { fmtTime } from "@/lib/format";

interface Campaign { campaignId: string; campaignName: string; spend: number; impressions: number; clicks: number; conversations: number; leads: number; warm: number }
interface CapiRow { id: string; leadId: string; leadName?: string; eventName: string; at: number; ok: boolean; response?: string }
interface Info {
  whatsapp: { configured: boolean; verifyTokenSet: boolean; appSecretSet: boolean; wabaSet: boolean; phone: { number?: string; name?: string; quality?: string; error?: string } | null };
  ai: { configured: boolean; model: string };
  meta: { appConfigured: boolean; connected: boolean; userName?: string; adAccountId?: string; adAccountName?: string; datasetId?: string; datasetName?: string; autoSend: boolean; ctwaEventName: string; crmEventName: string; testEventCode?: string; tokenExpiresAt?: number };
  insights: { syncedAt: number; datePreset: string; campaigns: Campaign[] } | null;
  capiLog: CapiRow[];
}

const rupiah = (n: number) => n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString("id-ID");

async function rpc(action: string, args: Record<string, unknown> = {}) {
  const res = await fetch("/api/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, args }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

export default function IntegrationsPage() {
  return <Suspense><Integrations /></Suspense>;
}

function Integrations() {
  const { live, leads } = useStore();
  const params = useSearchParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const demoInfo = useDemoInfo(leads);
  const load = useCallback(async () => {
    if (!live) return;
    const res = await fetch("/api/integrations", { cache: "no-store" });
    const d = await res.json();
    if (res.ok) { setInfo(d); setLoadErr(""); } else setLoadErr(d.error ?? "Gagal memuat");
  }, [live]);
  useEffect(() => { load(); }, [load]);

  const data = live ? info : demoInfo.info;
  const banner = params.get("meta");

  return (
    <>
      <PageHeader title="Integrasi" desc="Hubungkan WhatsApp, AI chatbot, dan Meta Ads. Token & secret tidak pernah ditampilkan di sini." />
      {banner && <div className={`mb-4 rounded-lg p-3 text-sm ${banner === "connected" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{{ connected: "Akun Meta berhasil terhubung. Pilih ad account dan dataset di bawah.", cancelled: "Login Facebook dibatalkan.", "invalid-state": "Sesi login tidak valid, coba lagi.", "no-app": "META_APP_ID / META_APP_SECRET belum di-set di Vercel." }[banner] ?? banner}</div>}
      {!live && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Mode demo — semua koneksi di halaman ini disimulasikan. Ikuti panduan <b>SETUP.md</b> di repo untuk menyalakan versi live.</div>}
      {loadErr && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadErr}</div>}
      {!data ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Memuat…</div> : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusCard icon={Database} title="Database" ok={live} desc={live ? "Terhubung" : "Belum di-set (mode demo)"} />
            <StatusCard icon={MessageCircle} title="WhatsApp" ok={data.whatsapp.configured && !data.whatsapp.phone?.error} desc={data.whatsapp.phone?.number ? `${data.whatsapp.phone.number} · ${data.whatsapp.phone.name}` : data.whatsapp.phone?.error ?? "Belum terhubung"} />
            <StatusCard icon={Bot} title="AI Chatbot" ok={data.ai.configured} desc={data.ai.configured ? data.ai.model : "Mock kata kunci (belum ada API key)"} />
            <StatusCard icon={Facebook} title="Meta Ads & CAPI" ok={data.meta.connected && Boolean(data.meta.datasetId)} desc={data.meta.connected ? data.meta.userName ?? "Terhubung" : "Belum login"} />
          </div>

          <WhatsAppSection info={data} origin={origin} live={live} />
          <MetaSection info={data} live={live} reload={live ? load : demoInfo.update} />
        </div>
      )}
    </>
  );
}

function StatusCard({ icon: Icon, title, ok, desc }: { icon: React.ElementType; title: string; ok: boolean; desc: string }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold">{title}{ok ? <CheckCircle2 size={14} className="text-emerald-600" /> : <XCircle size={14} className="text-slate-400" />}</div>
        <div className="truncate text-xs text-slate-500">{desc}</div>
      </div>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <li className="flex items-start gap-2 text-sm">{ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-slate-300" />}<span>{children}</span></li>;
}

function WhatsAppSection({ info, origin, live }: { info: Info; origin: string; live: boolean }) {
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const hook = `${origin}/api/whatsapp/webhook`;
  const w = info.whatsapp;
  return (
    <section className="card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold"><MessageCircle size={18} className="text-emerald-600" /> WhatsApp Cloud API — nomor chatbot</h2>
      <p className="mb-4 text-sm text-slate-500">Cukup daftarkan satu nomor baru di Meta. Semua pesan masuk ke nomor itu akan dijawab AI, lalu diteruskan ke agent sesuai domisili.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Checklist</div>
          <ul className="space-y-2">
            <Check ok={w.configured}>Token & Phone Number ID (<code className="text-xs">WHATSAPP_TOKEN</code>, <code className="text-xs">WHATSAPP_PHONE_NUMBER_ID</code>)</Check>
            <Check ok={w.appSecretSet}>App secret untuk validasi webhook (<code className="text-xs">META_APP_SECRET</code>)</Check>
            <Check ok={w.verifyTokenSet}>Verify token webhook (<code className="text-xs">WHATSAPP_VERIFY_TOKEN</code>)</Check>
            <Check ok={w.wabaSet}>WABA ID untuk template & CAPI (<code className="text-xs">WHATSAPP_WABA_ID</code>)</Check>
            <Check ok={info.ai.configured}>API key AI (<code className="text-xs">ANTHROPIC_API_KEY</code>) — tanpa ini bot memakai mode kata kunci</Check>
          </ul>
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Callback URL (tempel di Meta → WhatsApp → Configuration)</div>
            <div className="flex gap-2"><input readOnly className="input font-mono text-xs" value={hook} /><button className="btn-ghost shrink-0" onClick={() => navigator.clipboard.writeText(hook)} aria-label="Salin"><Copy size={14} /></button></div>
            <p className="mt-1 text-xs text-slate-500">Webhook fields yang dicentang: <code>messages</code>.</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Kirim pesan tes</div>
            <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!live) { setMsg("Demo: pesan tes tidak benar-benar dikirim."); return; } try { await rpc("testWhatsapp", { to }); setMsg("Terkirim ✅ cek WhatsApp tujuan."); } catch (er) { setMsg((er as Error).message); } }}>
              <input className="input" placeholder="62812xxxxxxx" value={to} onChange={(e) => setTo(e.target.value)} />
              <button className="btn-primary shrink-0" disabled={!to}><Send size={14} /> Kirim</button>
            </form>
            {msg && <p className="mt-1 text-xs text-slate-600">{msg}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetaSection({ info, live, reload }: { info: Info; live: boolean; reload: (patch?: Partial<Info["meta"]> & { _sync?: boolean; _disconnect?: boolean }) => unknown }) {
  const m = info.meta;
  const [accounts, setAccounts] = useState<{ id: string; name: string; currency?: string }[] | null>(null);
  const [datasets, setDatasets] = useState<{ id: string; name: string }[] | null>(null);
  const [form, setForm] = useState({ autoSend: m.autoSend, ctwaEventName: m.ctwaEventName, crmEventName: m.crmEventName, testEventCode: m.testEventCode ?? "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const run = async (label: string, fn: () => Promise<unknown>) => { setBusy(label); setErr(""); try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } };

  useEffect(() => {
    if (!m.connected) return;
    if (!live) { setAccounts([{ id: "act_1234567890", name: "DIPO Mitsubishi Ads", currency: "IDR" }]); setDatasets([{ id: "998877665544", name: "DIPO CRM Dataset" }]); return; }
    rpc("metaAdAccounts").then((d) => setAccounts(d.accounts)).catch((e) => setErr(e.message));
  }, [m.connected, live]);
  useEffect(() => {
    if (!live || !m.adAccountId) return;
    rpc("metaDatasets", { adAccountId: m.adAccountId }).then((d) => setDatasets(d.datasets)).catch((e) => setErr(e.message));
  }, [live, m.adAccountId]);

  const save = (patch: Record<string, unknown>) => run("save", async () => { if (live) { await rpc("metaSaveSettings", patch); await reload(); } else reload(patch); });
  const totals = useMemo(() => (info.insights?.campaigns ?? []).reduce((t, c) => ({ spend: t.spend + c.spend, conv: t.conv + c.conversations, leads: t.leads + c.leads, warm: t.warm + c.warm }), { spend: 0, conv: 0, leads: 0, warm: 0 }), [info.insights]);

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Facebook size={18} className="text-blue-600" /> Meta Business — hasil iklan & Conversions API</h2>
          <p className="text-sm text-slate-500">Login sekali dengan akun Facebook yang punya akses ke Business Manager DIPO. Hasil iklan di-sync otomatis tiap hari, dan setiap lead WARM otomatis dikirim ke Meta sebagai konversi.</p>
        </div>
        {m.connected ? (
          <div className="flex items-center gap-2 text-sm"><span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">Terhubung: {m.userName}</span><button className="btn-ghost" onClick={() => run("disc", async () => { if (live) { await rpc("metaDisconnect"); await reload(); } else reload({ _disconnect: true }); })}>Putuskan</button></div>
        ) : (
          <a href={live ? "/api/meta/oauth/start" : "#"} onClick={(e) => { if (!live) { e.preventDefault(); reload({ connected: true, userName: "Admin DIPO (demo)" }); } }} className="btn inline-flex bg-[#1877F2] text-white hover:bg-[#166fe5]"><Facebook size={16} /> Login dengan Facebook</a>
        )}
      </div>
      {!m.appConfigured && live && <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Isi <code>META_APP_ID</code> dan <code>META_APP_SECRET</code> di Vercel dulu supaya tombol login berfungsi.</div>}
      {err && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {m.connected && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="text-sm font-semibold">1. Pilih akun</div>
              <label className="block text-xs text-slate-500">Ad account
                <select className="input mt-1" value={m.adAccountId ?? ""} onChange={(e) => { const a = accounts?.find((x) => x.id === e.target.value); save({ adAccountId: a?.id, adAccountName: a?.name, datasetId: undefined, datasetName: undefined }); }}>
                  <option value="">{accounts ? "Pilih…" : "Memuat…"}</option>
                  {accounts?.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
                </select>
              </label>
              <label className="block text-xs text-slate-500">Dataset / Pixel untuk Conversions API
                <select className="input mt-1" value={m.datasetId ?? ""} disabled={!m.adAccountId} onChange={(e) => { const d = datasets?.find((x) => x.id === e.target.value); save({ datasetId: d?.id, datasetName: d?.name }); }}>
                  <option value="">{m.adAccountId ? (datasets ? "Pilih…" : "Memuat…") : "Pilih ad account dulu"}</option>
                  {datasets?.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.id})</option>)}
                </select>
              </label>
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <div className="text-sm font-semibold">2. Offline conversion (lead WARM → Meta)</div>
              <label className="flex items-center justify-between text-sm"><span>Kirim otomatis saat lead jadi WARM</span><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.autoSend} onChange={(e) => setForm({ ...form, autoSend: e.target.checked })} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500">Event (lead dari iklan CTWA)<input className="input mt-1" value={form.ctwaEventName} onChange={(e) => setForm({ ...form, ctwaEventName: e.target.value })} /></label>
                <label className="text-xs text-slate-500">Event (lead lain)<input className="input mt-1" value={form.crmEventName} onChange={(e) => setForm({ ...form, crmEventName: e.target.value })} /></label>
              </div>
              <label className="block text-xs text-slate-500">Test event code (opsional, dari Events Manager → Test events)<input className="input mt-1" value={form.testEventCode} onChange={(e) => setForm({ ...form, testEventCode: e.target.value })} placeholder="TEST12345" /></label>
              <button className="btn-primary" disabled={busy === "save"} onClick={() => save({ ...form, testEventCode: form.testEventCode || undefined })}>{busy === "save" ? <Loader2 size={14} className="animate-spin" /> : null} Simpan</button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div><div className="text-sm font-semibold">Hasil iklan (30 hari terakhir)</div><div className="text-xs text-slate-500">{info.insights ? `Terakhir sync ${fmtTime(info.insights.syncedAt)} · otomatis tiap hari` : "Belum pernah sync"}</div></div>
              <button className="btn-ghost" disabled={!m.adAccountId || busy === "sync"} onClick={() => run("sync", async () => { if (live) { await rpc("metaSync"); await reload(); } else reload({ _sync: true }); })}>{busy === "sync" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync sekarang</button>
            </div>
            {info.insights && (
              <>
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[["Spend", rupiah(totals.spend)], ["Percakapan WA", num(totals.conv)], ["Lead di CRM", num(totals.leads)], ["Biaya / lead WARM", totals.warm ? rupiah(totals.spend / totals.warm) : "—"]].map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 p-3"><div className="text-lg font-bold tabular-nums">{v}</div><div className="text-xs text-slate-500">{k}</div></div>)}
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[760px]">
                    <thead className="bg-slate-50"><tr>{["Campaign", "Spend", "Impresi", "Klik", "Percakapan WA", "Lead CRM", "WARM", "Biaya/WARM"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {info.insights.campaigns.map((c) => (
                        <tr key={c.campaignId}><td className="td font-medium">{c.campaignName}</td><td className="td tabular-nums">{rupiah(c.spend)}</td><td className="td tabular-nums">{num(c.impressions)}</td><td className="td tabular-nums">{num(c.clicks)}</td><td className="td tabular-nums">{num(c.conversations)}</td><td className="td tabular-nums">{c.leads}</td><td className="td tabular-nums">{c.warm}</td><td className="td tabular-nums">{c.warm ? rupiah(c.spend / c.warm) : "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-slate-400">Lead CRM & WARM dihitung dari lead yang masuk lewat iklan Click-to-WhatsApp (ad id tercatat dari referral).</p>
              </>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Log Conversions API</div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50"><tr>{["Waktu", "Lead", "Event", "Status", "Respon Meta"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {info.capiLog.length === 0 && <tr><td colSpan={5} className="td text-center text-slate-400">Belum ada event terkirim</td></tr>}
                  {info.capiLog.map((e) => (
                    <tr key={e.id}><td className="td whitespace-nowrap text-slate-500">{fmtTime(e.at)}</td><td className="td">{e.leadName ?? e.leadId}<div className="text-xs text-slate-400">{e.leadId}</div></td><td className="td font-mono text-xs">{e.eventName}</td><td className="td">{e.ok ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Terkirim</span> : <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Gagal</span>}</td><td className="td max-w-xs truncate font-mono text-[11px] text-slate-500" title={e.response}>{e.response}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <a className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700" href="https://developers.facebook.com/docs/marketing-api/conversions-api" target="_blank" rel="noreferrer">Dokumentasi Conversions API <ExternalLink size={12} /></a>
    </section>
  );
}

/** Data simulasi untuk mode demo. */
function useDemoInfo(leads: ReturnType<typeof useStore>["leads"]) {
  const [meta, setMeta] = useState<Info["meta"]>({ appConfigured: true, connected: false, autoSend: true, ctwaEventName: "LeadSubmitted", crmEventName: "Lead" });
  const [synced, setSynced] = useState<number | null>(null);
  const info = useMemo<Info>(() => {
    const meta_ = leads.filter((l) => l.source === "Meta Ads");
    const camps = ["CTWA - Promo Akhir Tahun", "CTWA - Xforce Launch", "CTWA - Pajero Sport Retargeting"].map((name, i) => {
      const ls = meta_.filter((_, j) => j % 3 === i);
      return { campaignId: `c${i}`, campaignName: name, spend: [4_850_000, 3_200_000, 1_750_000][i], impressions: [182_000, 121_500, 48_900][i], clicks: [3_420, 2_180, 960][i], conversations: [64, 41, 18][i], leads: ls.length, warm: ls.filter((l) => l.status === "WARM").length };
    });
    const capiLog = meta.datasetId ? leads.filter((l) => l.status === "WARM").slice(0, 12).map((l) => ({ id: l.id, leadId: l.id, leadName: l.name, eventName: l.source === "Meta Ads" ? meta.ctwaEventName : meta.crmEventName, at: l.assignedAt ?? l.createdAt, ok: true, response: '{"events_received":1}' })) : [];
    return { whatsapp: { configured: false, verifyTokenSet: false, appSecretSet: false, wabaSet: false, phone: null }, ai: { configured: false, model: "claude-opus-5-5" }, meta, insights: synced ? { syncedAt: synced, datePreset: "last_30d", campaigns: camps } : null, capiLog };
  }, [leads, meta, synced]);
  const update = (p?: Partial<Info["meta"]> & { _sync?: boolean; _disconnect?: boolean }) => {
    if (!p) return;
    if (p._sync) { setSynced(Date.now()); return; }
    if (p._disconnect) { setMeta((m) => ({ ...m, connected: false, userName: undefined, adAccountId: undefined, datasetId: undefined })); setSynced(null); return; }
    setMeta((m) => ({ ...m, ...p }));
    if (p.adAccountId) setSynced(Date.now());
  };
  return { info, update };
}
