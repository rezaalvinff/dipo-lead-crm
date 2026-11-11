"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Check, CheckCheck, CheckCircle2, Clock, Code2, FileText, Hand, RotateCcw, Search, Send, X } from "lucide-react";
import { inWindow, useStore, type LeadV } from "@/lib/store";
import { fmtTime, timeAgo } from "@/lib/format";
import { Empty, SourceBadge, StatusBadge } from "@/components/ui";
import AssignControl from "@/components/AssignControl";

const DEMO_TEMPLATES = [
  { name: "followup_minat", language: "id", body: "Halo {{1}}, kami dari Mitsubishi DIPO ingin menindaklanjuti minat Anda. Apakah masih berminat untuk informasi unit dan promo terbaru?", params: 1 },
  { name: "promo_unit", language: "id", body: "Halo {{1}}, ada promo spesial bulan ini untuk unit {{2}}. Balas pesan ini untuk info lebih lanjut.", params: 2 },
];

type Tab = "all" | "bot" | "queue" | "handled" | "done";
const TABS: [Tab, string][] = [["all", "Semua"], ["bot", "Bot"], ["queue", "Antrean"], ["handled", "Ditangani"], ["done", "Selesai"]];

const convStatus = (l: LeadV): Exclude<Tab, "all"> => (l.resolved ? "done" : l.aiActive ? "bot" : !l.agentId ? "queue" : "handled");
const displayName = (l: LeadV) => l.name ?? l.profileName ?? l.phone;

export default function InboxPage() {
  return <Suspense><Inbox /></Suspense>;
}

function Inbox() {
  const { visibleLeads, messagesFor, user, markRead } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const activeId = params.get("lead");
  const lead = visibleLeads.find((l) => l.id === activeId);

  useEffect(() => { if (activeId) markRead(activeId); }, [activeId, lead?.unread, markRead]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: visibleLeads.length, bot: 0, queue: 0, handled: 0, done: 0 };
    visibleLeads.forEach((l) => c[convStatus(l)]++);
    return c;
  }, [visibleLeads]);

  const list = useMemo(() => visibleLeads.filter((l) => {
    if (tab !== "all" && convStatus(l) !== tab) return false;
    const s = q.toLowerCase();
    return !s || [l.name, l.profileName, l.phone, l.city, l.unit, l.id].some((x) => x?.toLowerCase().includes(s));
  }), [visibleLeads, q, tab]);

  return (
    <div className="-mx-4 -my-4 flex h-[calc(100vh-3.5rem)] overflow-hidden bg-white sm:-m-6">
      <div className={`w-full shrink-0 flex-col border-r border-slate-200 md:flex md:w-80 ${lead ? "hidden" : "flex"}`}>
        <div className="space-y-2 border-b border-slate-200 p-3">
          <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Cari nama, nomor, kota…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="flex gap-1 overflow-x-auto text-xs">
            {TABS.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-medium ${tab === k ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>
                {label}<span className={`rounded-full px-1 text-[10px] ${tab === k ? "bg-white/20" : "bg-white"}`}>{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {list.length === 0 && <Empty text="Tidak ada percakapan" />}
          {list.map((l) => {
            const last = messagesFor(l.id).filter((m) => m.from !== "system").at(-1);
            const st = convStatus(l);
            return (
              <li key={l.id}>
                <button onClick={() => router.replace(`/inbox?lead=${l.id}`)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${l.id === activeId ? "bg-brand-50" : ""}`}>
                  <Avatar name={displayName(l)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className={`truncate text-sm ${l.unread ? "font-bold" : "font-semibold"}`}>{displayName(l)}</span><span className="shrink-0 text-[11px] text-slate-400">{timeAgo(last?.at ?? l.createdAt)}</span></div>
                    <div className="flex items-center gap-2">
                      <div className={`min-w-0 flex-1 truncate text-xs ${l.unread ? "text-slate-800" : "text-slate-500"}`}>{l.typing ? <span className="italic text-violet-600">AI sedang mengetik…</span> : <>{last?.from === "agent" ? `${last.author?.split(" ")[0]}: ` : last?.from === "ai" ? "🤖 " : ""}{last?.text}</>}</div>
                      {!!l.unread && <span className="rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">{l.unread}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1"><StatusBadge status={l.status} inQueue={l.inQueue && st === "queue"} /><StatusPill st={st} />{l.source === "Meta Ads" && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">ADS</span>}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {lead ? <Chat key={lead.id} lead={lead} onBack={() => router.replace("/inbox")} /> : <div className="hidden flex-1 place-items-center text-sm text-slate-400 md:grid">Pilih percakapan di sebelah kiri</div>}
      {lead && <DetailPanel lead={lead} isAdmin={user?.role === "admin"} />}
    </div>
  );
}

function StatusPill({ st }: { st: Exclude<Tab, "all"> }) {
  const m = { bot: ["Bot", "bg-violet-100 text-violet-700"], queue: ["Antrean", "bg-amber-100 text-amber-800"], handled: ["Ditangani", "bg-emerald-100 text-emerald-700"], done: ["Selesai", "bg-slate-200 text-slate-600"] }[st];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m[1]}`}>{m[0]}</span>;
}

function Chat({ lead: l, onBack }: { lead: LeadV; onBack: () => void }) {
  const { messagesFor, sendReply, sendTemplate, setAi, setResolved, live } = useStore();
  const msgs = messagesFor(l.id);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string>();
  const [liveTemplates, setLiveTemplates] = useState<typeof DEMO_TEMPLATES | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const open24 = inWindow(l);
  const st = convStatus(l);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length, l.typing]);
  useEffect(() => {
    if (!live || open24 || liveTemplates) return;
    fetch("/api/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "templates" }) })
      .then((r) => r.json()).then((d) => setLiveTemplates(d.templates ?? [])).catch(() => setLiveTemplates([]));
  }, [live, open24, liveTemplates]);
  const templates = live ? liveTemplates : DEMO_TEMPLATES;

  const send = async () => {
    if (!text.trim()) return;
    const r = await sendReply(l.id, text.trim());
    if (r.ok) { setText(""); setErr(undefined); } else setErr(r.error);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <button className="md:hidden" onClick={onBack} aria-label="Kembali"><ArrowLeft size={20} /></button>
        <Avatar name={displayName(l)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{displayName(l)}</span><StatusPill st={st} /></div>
          <div className="truncate text-xs text-slate-500">{l.phone} · {l.city ?? "domisili ?"} · {l.unit ?? "unit ?"}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {l.aiActive
            ? <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setAi(l.id, false)} title="Hentikan bot, CS membalas manual"><Hand size={14} /> <span className="hidden sm:inline">Ambil alih</span></button>
            : <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setAi(l.id, true)} title="Bot melanjutkan menjawab"><Bot size={14} /> <span className="hidden sm:inline">Aktifkan bot</span></button>}
          {l.resolved
            ? <button className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => setResolved(l.id, false)}><RotateCcw size={14} /> <span className="hidden sm:inline">Buka lagi</span></button>
            : <button className="btn-ghost px-2.5 py-1.5 text-xs text-emerald-700" onClick={() => setResolved(l.id, true)}><CheckCircle2 size={14} /> <span className="hidden sm:inline">Selesai</span></button>}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
        {msgs.map((m) => m.from === "system" ? (
          <div key={m.id} className="mx-auto w-fit max-w-[90%] rounded-md bg-white/70 px-3 py-1 text-center text-[11px] text-slate-500">{m.text}</div>
        ) : (
          <div key={m.id} className={`flex ${m.from === "customer" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${m.from === "customer" ? "bg-white" : m.from === "ai" ? "bg-violet-100" : "bg-[#d9fdd3]"}`}>
              {m.from !== "customer" && <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">{m.from === "ai" ? <><Bot size={12} /> AI Assistant</> : <>{m.author}{m.template && " · template"}</>}</div>}
              <div className="whitespace-pre-wrap">{m.text}</div>
              {m.sources?.length ? (
                <div className="mt-1.5 border-t border-violet-200 pt-1 text-[10px] text-violet-700">📚 Konteks RAG: {m.sources.map((s) => `${s.title} #${s.index + 1} (${s.score})`).join(" · ")}</div>
              ) : m.knowledge ? <div className="mt-1 text-[10px] text-violet-700">📚 {m.knowledge}</div> : null}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">{fmtTime(m.at)}{m.status === "sent" && <Check size={12} />}{m.status === "delivered" && <CheckCheck size={12} />}{m.status === "read" && <CheckCheck size={12} className="text-sky-500" />}</div>
            </div>
          </div>
        ))}
        {l.typing && <div className="flex justify-end"><div className="flex items-center gap-1 rounded-lg bg-violet-100 px-3 py-2 text-xs text-violet-700"><Bot size={12} /> AI sedang mengetik<span className="animate-pulse">…</span></div></div>}
        <div ref={end} />
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        {l.aiActive && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700">
            <span className="flex items-center gap-2"><Bot size={14} /> Bot sedang menangani percakapan ini. Membalas = human takeover.</span>
            <button className="font-semibold underline" onClick={() => setAi(l.id, false)}>Ambil alih</button>
          </div>
        )}
        {!open24 && <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><Clock size={14} /> Di luar 24-hour window — hanya template approved yang bisa dikirim.</div>}
        {err && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
        {!open24 ? (
          <div className="flex flex-col gap-2">
            {templates === null && <div className="text-xs text-slate-400">Memuat template…</div>}
            {templates?.length === 0 && <div className="text-xs text-slate-500">Belum ada template approved.</div>}
            {templates?.map((t) => {
              const params = Array.from({ length: t.params }, (_, i) => (i === 0 ? l.name ?? "Bapak/Ibu" : l.unit ?? "Mitsubishi"));
              const preview = params.reduce((b, p, i) => b.replace(`{{${i + 1}}}`, p), t.body);
              return <button key={t.name + t.language} onClick={async () => { const r = await sendTemplate(l.id, t, params); setErr(r.ok ? undefined : r.error); }} className="btn-ghost justify-start text-left text-xs"><FileText size={14} className="shrink-0" /><span><b>{t.name}</b> · {preview}</span></button>;
            })}
          </div>
        ) : (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <input className="input" placeholder="Ketik balasan… (dikirim via nomor WA pusat)" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn-primary" disabled={!text.trim()} aria-label="Kirim"><Send size={16} /></button>
          </form>
        )}
      </div>
    </div>
  );
}

function DetailPanel({ lead: l, isAdmin }: { lead: LeadV; isAdmin: boolean }) {
  const { userById } = useStore();
  const [payload, setPayload] = useState(false);
  const leadSource = l.source === "Meta Ads" ? "META_ADS" : "ORGANIC";
  const Row = ({ k, v, mono }: { k: string; v?: string; mono?: boolean }) => <div><dt className="text-[11px] text-slate-500">{k}</dt><dd className={`break-all text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>{v ?? "—"}</dd></div>;
  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 xl:block">
      <Section title="Kontak">
        <Row k="Nama profil WhatsApp" v={l.profileName} />
        <Row k="Nomor (WA ID)" v={l.phone} mono />
        <Row k="ID Lead" v={l.id} mono />
      </Section>
      <Section title="Kualifikasi AI">
        {([["Nama", l.name], ["Domisili", l.city], ["Unit", l.unit]] as const).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm"><span className="text-slate-500">{k}</span><span className={v ? "font-medium" : "text-slate-400"}>{v ?? "belum"} {v && "✓"}</span></div>
        ))}
        <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Status</span><StatusBadge status={l.status} /></div>
      </Section>
      <Section title="Atribusi sumber">
        <div className="flex items-center gap-2"><span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${leadSource === "META_ADS" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{leadSource}</span><SourceBadge source={l.source} /></div>
        {l.source === "Meta Ads" && <>
          <Row k="Headline iklan" v={l.adHeadline ?? l.campaign} />
          <Row k="ad_id (referral.source_id)" v={l.adId} mono />
          <Row k="source_url" v={l.sourceUrl} mono />
          <Row k="ctwa_clid" v={l.ctwaClid} mono />
        </>}
        <button className="btn-ghost w-full text-xs" onClick={() => setPayload(true)}><Code2 size={14} /> Lihat payload webhook</button>
      </Section>
      <Section title="Penanganan">
        <Row k="Agent" v={userById(l.agentId)?.name ?? "Belum ditugaskan"} />
        {l.queueReason && !l.agentId && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{l.queueReason}</div>}
        {isAdmin && <AssignControl lead={l} />}
      </Section>
      {payload && <PayloadModal lead={l} onClose={() => setPayload(false)} />}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="space-y-2 border-b border-slate-100 p-4"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>{children}</div>;
}

function PayloadModal({ lead: l, onClose }: { lead: LeadV; onClose: () => void }) {
  const { messagesFor } = useStore();
  const first = messagesFor(l.id).find((m) => m.from === "customer");
  const msg: Record<string, unknown> = { from: l.phone.replace(/\D/g, ""), id: `wamid.${first?.id ?? "x"}`, timestamp: String(Math.floor((first?.at ?? l.createdAt) / 1000)), type: "text", text: { body: first?.text ?? "" } };
  if (l.source === "Meta Ads") msg.referral = { source_url: l.sourceUrl, source_id: l.adId, source_type: "ad", headline: l.adHeadline ?? l.campaign, media_type: "image", ctwa_clid: l.ctwaClid };
  const body = { object: "whatsapp_business_account", entry: [{ id: "WABA_ID", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "62811xxxxxxx", phone_number_id: "PHONE_NUMBER_ID" }, contacts: [{ profile: { name: l.profileName ?? l.name ?? "" }, wa_id: l.phone.replace(/\D/g, "") }], messages: [msg] } }] }] };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div><h2 className="font-semibold">Payload webhook pesan pertama</h2><p className="text-xs text-slate-500">Backend membaca <code>messages[0].referral</code> → {l.source === "Meta Ads" ? "ada → META_ADS" : "tidak ada → ORGANIC"}; nomor dari <code>messages[0].from</code>, nama dari <code>contacts[0].profile.name</code>.</p></div>
          <button onClick={onClose} aria-label="Tutup"><X size={20} /></button>
        </div>
        <pre className="overflow-auto bg-slate-900 p-4 text-xs leading-relaxed text-emerald-200">{JSON.stringify(body, null, 2)}</pre>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">{name.charAt(0).toUpperCase()}</div>;
}
