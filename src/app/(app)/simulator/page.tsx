"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bot, RefreshCw, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { LEAD_SOURCES, type LeadSource } from "@/lib/types";
import { PageHeader, StatusBadge } from "@/components/ui";

const randPhone = () => `+62 81${Math.floor(Math.random() * 9)} ${Math.floor(1000 + Math.random() * 8999)} ${Math.floor(1000 + Math.random() * 8999)}`;

const SCENARIOS = [
  { label: "Data lengkap sekaligus → WARM", text: "Halo, nama saya Andi Wijaya dari Medan, mau tanya Pajero Sport" },
  { label: "Domisili Karawang → agent Jakarta", text: "Saya Bambang dari Karawang, minat Xforce" },
  { label: "Di luar wilayah → Admin", text: "Saya Rina dari Cikarang, minat Xpander" },
  { label: "RAG: dokumen kredit", text: "Halo kak, dokumen apa saja yang perlu buat kredit?" },
  { label: "RAG: test drive di rumah", text: "Test drive bisa di rumah gak?" },
];

export default function SimulatorPage() {
  const { simulateInbound, messagesFor, leads, userById: agentById } = useStore();
  const [phone, setPhone] = useState(randPhone);
  const [source, setSource] = useState<LeadSource>("Meta Ads");
  const [text, setText] = useState("");
  const [leadId, setLeadId] = useState<string>();
  const end = useRef<HTMLDivElement>(null);
  const msgs = leadId ? messagesFor(leadId) : [];
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);
  const lead = leads.find((l) => l.id === leadId);

  const [busy, setBusy] = useState(false);
  const send = async (t: string) => {
    if (!t.trim() || busy) return;
    setText(""); setBusy(true);
    try { setLeadId(await simulateInbound(phone, t.trim(), source)); } finally { setBusy(false); }
  };
  const restart = () => { setPhone(randPhone()); setLeadId(undefined); };

  return (
    <>
      <PageHeader title="Simulator Chat" desc="Coba chat sebagai pelanggan: AI menjawab pakai knowledge, mengumpulkan nama/domisili/unit, lalu meneruskan ke agent sesuai wilayah. Tidak mengirim pesan WhatsApp sungguhan." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4">
          <div className="card space-y-3 p-5">
            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Nomor pelanggan (sender ID)</label><input className="input" value={phone} onChange={(e) => { setPhone(e.target.value); setLeadId(undefined); }} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-500">Sumber (referral)</label><select className="input" value={source} onChange={(e) => setSource(e.target.value as LeadSource)} disabled={!!leadId}>{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <button className="btn-ghost w-full" onClick={restart}><RefreshCw size={14} /> Pelanggan baru</button>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">Skenario cepat</h2>
            <div className="space-y-2">{SCENARIOS.map((s) => <button key={s.label} className="btn-ghost w-full justify-start text-left text-xs" onClick={() => { restart(); setTimeout(() => setText(s.text)); }}>{s.label}</button>)}</div>
          </div>
          {lead && (
            <div className="card space-y-2 p-5 text-sm">
              <h2 className="font-semibold">Hasil ekstraksi AI</h2>
              {[["Nama", lead.name], ["Domisili", lead.city], ["Unit", lead.unit]].map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-500">{k}</span><span className={v ? "font-medium" : "text-slate-400"}>{v ?? "belum"}</span></div>)}
              <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={lead.status} inQueue={lead.inQueue} /></div>
              <div className="flex justify-between"><span className="text-slate-500">Agent</span><span className="font-medium">{agentById(lead.agentId)?.name ?? "—"}</span></div>
              <Link href={`/inbox?lead=${lead.id}`} className="btn-primary mt-2 w-full">Buka di Inbox</Link>
            </div>
          )}
        </div>

        <div className="card flex h-[600px] flex-col overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm"><Bot size={16} className="text-violet-600" /><span className="font-semibold">Tampilan sisi pelanggan</span><span className="ml-auto text-xs text-slate-400">{phone}</span></div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
            {msgs.length === 0 && <div className="mt-20 text-center text-sm text-slate-500">Kirim pesan pertama sebagai pelanggan…</div>}
            {msgs.map((m) => m.from === "system" ? (
              <div key={m.id} className="mx-auto w-fit max-w-[90%] rounded-md bg-white/70 px-3 py-1 text-center text-[11px] text-slate-500">{m.text}</div>
            ) : (
              <div key={m.id} className={`flex ${m.from === "customer" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${m.from === "customer" ? "bg-[#d9fdd3]" : "bg-white"}`}>
                  {m.from !== "customer" && <div className="mb-0.5 text-[11px] font-semibold text-slate-500">{m.from === "ai" ? "Mitsubishi DIPO (AI)" : `Mitsubishi DIPO · ${m.author}`}</div>}
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  {m.sources?.length ? <div className="mt-1 text-[10px] text-violet-600">📚 Konteks RAG: {m.sources.map((x) => `${x.title} #${x.index + 1} (${x.score})`).join(" · ")}</div> : m.knowledge ? <div className="mt-1 text-[10px] text-violet-600">📚 {m.knowledge}</div> : null}
                </div>
              </div>
            ))}
            {lead?.typing && <div className="flex justify-start"><div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">Mitsubishi DIPO sedang mengetik<span className="animate-pulse">…</span></div></div>}
            <div ref={end} />
          </div>
          <form className="flex gap-2 border-t border-slate-200 p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input className="input" placeholder='Contoh: "Saya Budi dari Medan, mau Xpander"' value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn-primary" disabled={!text.trim() || busy}>{busy ? "…" : <Send size={16} />}</button>
          </form>
        </div>
      </div>
    </>
  );
}
