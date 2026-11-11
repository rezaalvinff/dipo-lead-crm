"use client";

import { useState } from "react";
import { Bot, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { matchKnowledge } from "@/lib/ai";
import { PageHeader } from "@/components/ui";
import type { BotSettings, KnowledgeItem } from "@/lib/types";

export default function KnowledgePage() {
  const [tab, setTab] = useState<"kb" | "flow">("kb");
  return (
    <>
      <PageHeader title="Knowledge Chatbot" desc="Atur pengetahuan dan gaya bahasa AI supaya jawabannya sesuai keinginan DIPO." />
      <div className="mb-4 flex gap-1">
        {([["kb", "Knowledge base"], ["flow", "Persona & alur pertanyaan"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{l}</button>
        ))}
      </div>
      {tab === "kb" ? <KnowledgeBase /> : <FlowSettings />}
    </>
  );
}

function KnowledgeBase() {
  const { knowledge, saveKnowledge, deleteKnowledge } = useStore();
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [q, setQ] = useState("");
  const hit = q.trim() ? matchKnowledge(q, knowledge) : undefined;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-3 xl:col-span-2">
        <div className="flex justify-end"><button className="btn-primary" onClick={() => setEditing({ id: `k-${Date.now()}`, title: "", category: "", keywords: [], answer: "", active: true })}><Plus size={16} /> Tambah knowledge</button></div>
        {knowledge.map((k) => (
          <div key={k.id} className={`card p-4 ${k.active ? "" : "opacity-60"}`}>
            <div className="mb-2 flex items-start gap-2">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{k.title}</span>{k.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{k.category}</span>}{!k.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">Nonaktif</span>}</div>
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" className="accent-brand-600" checked={k.active} onChange={(e) => saveKnowledge({ ...k, active: e.target.checked })} />Aktif</label>
              <button className="btn-ghost px-2" aria-label="Edit" onClick={() => setEditing({ ...k })}><Pencil size={14} /></button>
              <button className="btn-ghost px-2 text-red-600" aria-label="Hapus" onClick={() => confirm(`Hapus "${k.title}"?`) && deleteKnowledge(k.id)}><Trash2 size={14} /></button>
            </div>
            <p className="mb-2 whitespace-pre-wrap text-sm text-slate-700">{k.answer}</p>
            <div className="flex flex-wrap gap-1">{k.keywords.map((w) => <span key={w} className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] text-violet-700">{w}</span>)}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Bot size={16} className="text-violet-600" /> Uji jawaban</h2>
          <p className="mb-3 text-xs text-slate-500">Ketik pertanyaan pelanggan untuk melihat knowledge mana yang dipakai.</p>
          <input className="input" placeholder="mis. ada promo gak kak? bisa kredit?" value={q} onChange={(e) => setQ(e.target.value)} />
          {q.trim() && (hit ? (
            <div className="mt-3 rounded-lg bg-violet-50 p-3 text-sm"><div className="mb-1 text-xs font-semibold text-violet-700">Pakai: {hit.title}</div>{hit.answer}</div>
          ) : <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Tidak ada knowledge yang cocok — AI lanjut menanyakan data kualifikasi.</div>)}
        </div>
        <div className="card p-5 text-xs text-slate-500">
          <div className="mb-1 font-semibold text-slate-700">Cara kerja</div>
          Di prototype ini, AI memilih jawaban berdasarkan <b>kata kunci</b>. Di versi produksi, seluruh knowledge + persona dikirim ke model AI sebagai konteks, sehingga AI bisa menjawab lebih natural walau kata-katanya tidak persis sama.
        </div>
      </div>

      {editing && (
        <KnowledgeForm initial={editing} onClose={() => setEditing(null)} onSave={(k) => { saveKnowledge(k); setEditing(null); }} />
      )}
    </div>
  );
}

function KnowledgeForm({ initial, onClose, onSave }: { initial: KnowledgeItem; onClose: () => void; onSave: (k: KnowledgeItem) => void }) {
  const [k, setK] = useState(initial);
  const [kw, setKw] = useState(initial.keywords.join(", "));
  const valid = k.title.trim() && k.answer.trim() && kw.trim();
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">{initial.title ? "Edit knowledge" : "Tambah knowledge"}</h2><button onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div><div className="mb-1 text-sm font-medium">Judul / topik</div><input className="input" value={k.title} onChange={(e) => setK({ ...k, title: e.target.value })} placeholder="mis. Lokasi showroom Medan" /></div>
          <div><div className="mb-1 text-sm font-medium">Kategori</div><input className="input" value={k.category} onChange={(e) => setK({ ...k, category: e.target.value })} placeholder="mis. Info dealer" /></div>
          <div><div className="mb-1 text-sm font-medium">Kata kunci pemicu</div><input className="input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="alamat, lokasi, showroom" /><p className="mt-1 text-xs text-slate-500">Pisahkan dengan koma.</p></div>
          <div><div className="mb-1 text-sm font-medium">Jawaban AI</div><textarea rows={7} className="input" value={k.answer} onChange={(e) => setK({ ...k, answer: e.target.value })} placeholder="Tulis jawaban yang ingin disampaikan AI…" /></div>
        </div>
        <div className="flex gap-2 border-t border-slate-200 p-4"><button className="btn-ghost flex-1" onClick={onClose}>Batal</button><button className="btn-primary flex-1" disabled={!valid} onClick={() => onSave({ ...k, keywords: kw.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean) })}>Simpan</button></div>
      </div>
    </div>
  );
}

function FlowSettings() {
  const { bot, updateBot } = useStore();
  const [b, setB] = useState<BotSettings>(bot);
  const [units, setUnits] = useState(bot.units.join(", "));
  const [saved, setSaved] = useState(false);
  const set = (p: Partial<BotSettings>) => { setB({ ...b, ...p }); setSaved(false); };
  const fields: [keyof BotSettings, string, string, number][] = [
    ["persona", "Persona & instruksi AI", "Gaya bahasa, aturan, hal yang boleh/tidak boleh dijawab.", 5],
    ["greeting", "Pesan sapaan", "Dikirim di balasan pertama.", 2],
    ["askName", "Pertanyaan nama", "", 1],
    ["askCity", "Pertanyaan domisili", "Bisa pakai {nama}.", 1],
    ["askUnit", "Pertanyaan unit", "Bisa pakai {nama}.", 2],
    ["handover", "Pesan handover", "Dikirim saat data lengkap (lead jadi WARM). Bisa pakai {nama}, {domisili}, {unit}.", 3],
  ];
  return (
    <div className="card max-w-3xl space-y-5 p-5">
      {fields.map(([key, label, hint, rows]) => (
        <div key={key}>
          <div className="text-sm font-medium">{label}</div>
          {hint && <div className="mb-1 text-xs text-slate-500">{hint}</div>}
          <textarea rows={rows} className="input mt-1" value={b[key] as string} onChange={(e) => set({ [key]: e.target.value } as Partial<BotSettings>)} />
        </div>
      ))}
      <div>
        <div className="text-sm font-medium">Daftar unit yang dikenali AI</div>
        <div className="mb-1 text-xs text-slate-500">Pisahkan dengan koma.</div>
        <textarea rows={2} className="input" value={units} onChange={(e) => { setUnits(e.target.value); setSaved(false); }} />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={() => { updateBot({ ...b, units: units.split(",").map((x) => x.trim()).filter(Boolean) }); setSaved(true); }}><Save size={16} /> Simpan</button>
        {saved && <span className="text-sm text-emerald-600">Tersimpan. Coba di menu Simulator.</span>}
      </div>
    </div>
  );
}
