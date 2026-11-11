"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Check, CheckCheck, Clock, Search, Send, FileText } from "lucide-react";
import { inWindow, useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { fmtTime, timeAgo } from "@/lib/format";
import { Empty, SourceBadge, StatusBadge } from "@/components/ui";
import AssignControl from "@/components/AssignControl";

const TEMPLATES = [
  "Halo {nama}, kami dari Mitsubishi DIPO ingin menindaklanjuti minat Anda. Apakah masih berminat untuk informasi unit dan promo terbaru?",
  "Halo {nama}, ada promo spesial bulan ini untuk unit {unit}. Balas pesan ini untuk info lebih lanjut.",
];

export default function InboxPage() {
  return <Suspense><Inbox /></Suspense>;
}

function Inbox() {
  const { visibleLeads, messagesFor, agentById, user, sendReply } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "WARM" | "COLD" | "ai">("all");
  const activeId = params.get("lead");
  const lead = visibleLeads.find((l) => l.id === activeId);

  const list = useMemo(() => visibleLeads.filter((l) => {
    if (filter === "ai" ? !l.aiActive : filter !== "all" && l.status !== filter) return false;
    const s = q.toLowerCase();
    return !s || [l.name, l.phone, l.city, l.unit, l.id].some((x) => x?.toLowerCase().includes(s));
  }), [visibleLeads, q, filter]);

  const open = (id: string) => router.replace(`/inbox?lead=${id}`);

  return (
    <div className="card -mx-4 -my-4 flex h-[calc(100vh-3.5rem)] overflow-hidden rounded-none border-0 sm:-m-6 lg:rounded-none">
      {/* list */}
      <div className={`w-full shrink-0 flex-col border-r border-slate-200 md:flex md:w-80 ${lead ? "hidden" : "flex"}`}>
        <div className="space-y-2 border-b border-slate-200 p-3">
          <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Cari nama, nomor, kota…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="flex gap-1 text-xs">
            {(["all", "WARM", "COLD", "ai"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 font-medium ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}>{f === "all" ? "Semua" : f === "ai" ? "AI aktif" : f}</button>
            ))}
          </div>
        </div>
        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {list.length === 0 && <Empty text="Tidak ada percakapan" />}
          {list.map((l) => {
            const last = messagesFor(l.id).at(-1);
            return (
              <li key={l.id}>
                <button onClick={() => open(l.id)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${l.id === activeId ? "bg-brand-50" : ""}`}>
                  <Avatar name={l.name ?? "?"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{l.name ?? l.phone}</span><span className="shrink-0 text-[11px] text-slate-400">{timeAgo(last?.at ?? l.createdAt)}</span></div>
                    <div className="truncate text-xs text-slate-500">{last?.from === "agent" ? `${last.author?.split(" ")[0]}: ` : last?.from === "ai" ? "AI: " : ""}{last?.text}</div>
                    <div className="mt-1 flex items-center gap-1"><StatusBadge status={l.status} inQueue={l.inQueue} />{l.aiActive && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">AI</span>}</div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* chat */}
      {lead ? (
        <Chat key={lead.id} leadId={lead.id} onBack={() => router.replace("/inbox")} />
      ) : (
        <div className="hidden flex-1 place-items-center text-sm text-slate-400 md:grid">Pilih percakapan di sebelah kiri</div>
      )}

      {/* detail */}
      {lead && (
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-slate-200 p-4 xl:block">
          <h3 className="mb-3 text-sm font-semibold">Detail Lead</h3>
          <dl className="space-y-2 text-sm">
            {[["ID", lead.id], ["Nomor (dari WA)", lead.phone], ["Nama", lead.name], ["Domisili", lead.city], ["Unit", lead.unit], ["Campaign", lead.campaign]].map(([k, v]) => (
              <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-medium">{v ?? "—"}</dd></div>
            ))}
            <div><dt className="text-xs text-slate-500">Sumber</dt><dd><SourceBadge source={lead.source} /></dd></div>
            <div><dt className="text-xs text-slate-500">Status</dt><dd><StatusBadge status={lead.status} inQueue={lead.inQueue} /></dd></div>
            <div><dt className="text-xs text-slate-500">Sales</dt><dd className="font-medium">{agentById(lead.agentId)?.name ?? "Belum ditugaskan"}</dd></div>
            {lead.queueReason && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{lead.queueReason}</div>}
          </dl>
          {user && can.assign(user.role) && <div className="mt-4"><div className="mb-2 text-xs font-semibold text-slate-500">ASSIGN / REASSIGN</div><AssignControl lead={lead} /></div>}
        </aside>
      )}
    </div>
  );
}

function Chat({ leadId, onBack }: { leadId: string; onBack: () => void }) {
    const { visibleLeads, messagesFor, sendReply } = useStore();
    const l = visibleLeads.find((x) => x.id === leadId)!;
    const msgs = messagesFor(leadId);
    const [text, setText] = useState("");
    const [err, setErr] = useState<string>();
    const end = useRef<HTMLDivElement>(null);
    const open24 = inWindow(l);
    useEffect(() => { end.current?.scrollIntoView(); }, [msgs.length]);

    const send = (t: string, template = false) => {
      const r = sendReply(leadId, t, template);
      if (r.ok) { setText(""); setErr(undefined); } else setErr(r.error);
    };

    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <button className="md:hidden" onClick={onBack} aria-label="Kembali"><ArrowLeft size={20} /></button>
          <Avatar name={l.name ?? "?"} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{l.name ?? "Pelanggan baru"}</div>
            <div className="truncate text-xs text-slate-500">{l.phone} · {l.city ?? "domisili ?"} · {l.unit ?? "unit ?"}</div>
          </div>
          <StatusBadge status={l.status} inQueue={l.inQueue} />
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
          {msgs.map((m) => m.from === "system" ? (
            <div key={m.id} className="mx-auto w-fit max-w-[90%] rounded-md bg-white/70 px-3 py-1 text-center text-[11px] text-slate-500">{m.text}</div>
          ) : (
            <div key={m.id} className={`flex ${m.from === "customer" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${m.from === "customer" ? "bg-white" : m.from === "ai" ? "bg-violet-100" : "bg-[#d9fdd3]"}`}>
                {m.from !== "customer" && <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">{m.from === "ai" ? <><Bot size={12} /> AI Assistant</> : <>{m.author}{m.template && " · template"}</>}</div>}
                <div className="whitespace-pre-wrap">{m.text}</div>
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">{fmtTime(m.at)}{m.status === "sent" && <Check size={12} />}{m.status === "delivered" && <CheckCheck size={12} />}{m.status === "read" && <CheckCheck size={12} className="text-sky-500" />}</div>
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>

        <div className="border-t border-slate-200 bg-white p-3">
          {l.aiActive && <div className="mb-2 flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700"><Bot size={14} /> AI sedang mengumpulkan data. Membalas sekarang = human takeover (AI berhenti).</div>}
          {!open24 && <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><Clock size={14} /> Di luar 24-hour window — hanya template approved yang bisa dikirim.</div>}
          {err && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}
          {!open24 ? (
            <div className="flex flex-col gap-2">
              {TEMPLATES.map((t) => {
                const filled = t.replace("{nama}", l.name ?? "Bapak/Ibu").replace("{unit}", l.unit ?? "Mitsubishi");
                return <button key={t} onClick={() => send(filled, true)} className="btn-ghost justify-start text-left text-xs"><FileText size={14} className="shrink-0" />{filled}</button>;
              })}
            </div>
          ) : (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(text.trim()); }}>
              <input className="input" placeholder="Ketik balasan… (dikirim via nomor WA pusat)" value={text} onChange={(e) => setText(e.target.value)} />
              <button className="btn-primary" disabled={!text.trim()}><Send size={16} /></button>
            </form>
          )}
        </div>
      </div>
    );
}

function Avatar({ name }: { name: string }) {
  return <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">{name.charAt(0).toUpperCase()}</div>;
}
