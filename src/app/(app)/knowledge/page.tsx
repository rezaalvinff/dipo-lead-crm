"use client";

import { useState } from "react";
import { Bot, FileText, Pencil, Save, Trash2, Upload, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { answerFrom, chunkDoc, RAG_THRESHOLD, retrieve } from "@/lib/rag";
import { PageHeader } from "@/components/ui";
import type { BotSettings, KnowledgeItem } from "@/lib/types";

export default function KnowledgePage() {
  const [tab, setTab] = useState<"kb" | "flow">("kb");
  return (
    <>
      <PageHeader title="Knowledge Chatbot" desc="Atur pengetahuan dan gaya bahasa AI supaya jawabannya sesuai keinginan DIPO." />
      <div className="mb-4 flex gap-1">
        {([["kb", "Knowledge base (RAG)"], ["flow", "Persona & alur pertanyaan"]] as const).map(([k, l]) => (
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
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const hits = q.trim() ? retrieve(q, knowledge, 3) : [];
  const answer = answerFrom(hits, q);
  const totalChunks = knowledge.filter((k) => k.active).reduce((n, k) => n + chunkDoc(k).length, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-3 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-500">{knowledge.length} dokumen · {totalChunks} chunk aktif terindeks</div>
          <button className="btn-primary" onClick={() => setEditing({ id: `k-${Date.now()}`, title: "", category: "", keywords: [], answer: "", active: true })}><Upload size={16} /> Tambah dokumen</button>
        </div>
        {knowledge.map((k) => {
          const chunks = chunkDoc(k);
          return (
            <div key={k.id} className={`card p-4 ${k.active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600"><FileText size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{k.title}</span>{k.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{k.category}</span>}{!k.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">Nonaktif</span>}</div>
                  <div className="text-xs text-slate-500">{k.fileName ? `${k.fileName} · ` : ""}{k.answer.length.toLocaleString("id-ID")} karakter · {chunks.length} chunk</div>
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" className="accent-brand-600" checked={k.active} onChange={(e) => saveKnowledge({ ...k, active: e.target.checked })} />Aktif</label>
                <button className="btn-ghost px-2" aria-label="Edit" onClick={() => setEditing({ ...k })}><Pencil size={14} /></button>
                <button className="btn-ghost px-2 text-red-600" aria-label="Hapus" onClick={() => confirm(`Hapus "${k.title}"?`) && deleteKnowledge(k.id)}><Trash2 size={14} /></button>
              </div>
              <button className="mt-2 text-xs font-medium text-brand-600" onClick={() => setOpenDoc(openDoc === k.id ? null : k.id)}>{openDoc === k.id ? "Sembunyikan chunk" : "Lihat chunk"}</button>
              {openDoc === k.id && (
                <ol className="mt-2 space-y-2">
                  {chunks.map((c) => <li key={c.index} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700"><span className="mr-1 font-mono font-semibold text-violet-700">#{c.index + 1}</span>{c.text}</li>)}
                </ol>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-semibold"><Bot size={16} className="text-violet-600" /> Uji pencarian (retrieval)</h2>
          <p className="mb-3 text-xs text-slate-500">Ketik pertanyaan pelanggan. Sistem mencari chunk paling relevan, lalu AI menjawab berdasarkan konteks itu.</p>
          <input className="input" placeholder="mis. dokumen apa saja buat kredit?" value={q} onChange={(e) => setQ(e.target.value)} />
          {q.trim() && (
            <div className="mt-3 space-y-2">
              {hits.length === 0 && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Tidak ada konteks yang cocok — AI akan bilang sales yang akan membantu.</div>}
              {hits.map((h, i) => (
                <div key={h.docId + h.index} className="rounded-lg border border-slate-200 p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between"><span className="font-semibold">{i + 1}. {h.title} #{h.index + 1}</span><span className={`font-mono ${h.score >= RAG_THRESHOLD ? "text-emerald-600" : "text-slate-400"}`}>{h.score.toFixed(2)}</span></div>
                  <div className="mb-1 h-1 rounded bg-slate-100"><div className="h-1 rounded bg-violet-500" style={{ width: `${Math.min(100, h.score * 150)}%` }} /></div>
                  <div className="line-clamp-3 text-slate-600">{h.text}</div>
                </div>
              ))}
              {answer && <div className="rounded-lg bg-violet-50 p-3 text-sm"><div className="mb-1 text-xs font-semibold text-violet-700">Jawaban bot</div>{answer}</div>}
            </div>
          )}
        </div>
        <div className="card p-5 text-xs text-slate-500">
          <div className="mb-1 font-semibold text-slate-700">Cara kerja RAG</div>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Dokumen (FAQ, SOP, brosur) dipotong menjadi chunk ±400 karakter.</li>
            <li>Tiap chunk diubah menjadi vektor (embedding) dan disimpan.</li>
            <li>Saat pelanggan bertanya, pertanyaan juga diubah jadi vektor, lalu dicari chunk dengan skor kemiripan tertinggi.</li>
            <li>Chunk teratas dikirim ke AI sebagai konteks supaya jawabannya sesuai data DIPO, bukan karangan.</li>
          </ol>
          <p className="mt-2">Demo ini memakai vektor kata sederhana di browser. Versi produksi memakai embedding API + pgvector.</p>
        </div>
      </div>

      {editing && <KnowledgeForm initial={editing} onClose={() => setEditing(null)} onSave={(k) => { saveKnowledge(k); setEditing(null); }} />}
    </div>
  );
}

function KnowledgeForm({ initial, onClose, onSave }: { initial: KnowledgeItem; onClose: () => void; onSave: (k: KnowledgeItem) => void }) {
  const [k, setK] = useState(initial);
  const [kw, setKw] = useState(initial.keywords.join(", "));
  const [fileErr, setFileErr] = useState("");
  const valid = k.title.trim() && k.answer.trim();
  const onFile = (f?: File) => {
    if (!f) return;
    if (!/\.(txt|md|csv)$/i.test(f.name)) { setFileErr("Demo hanya membaca .txt, .md, atau .csv. Versi produksi bisa membaca PDF/DOCX."); return; }
    if (f.size > 500_000) { setFileErr("File maksimal 500 KB untuk demo."); return; }
    const r = new FileReader();
    r.onload = () => { setK((x) => ({ ...x, answer: String(r.result), fileName: f.name, title: x.title || f.name.replace(/\.[^.]+$/, "") })); setFileErr(""); };
    r.readAsText(f);
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="font-semibold">{initial.title ? "Edit dokumen" : "Tambah dokumen"}</h2><button onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 hover:border-brand-500">
            <Upload size={20} /> Upload file FAQ / SOP (.txt, .md, .csv)
            {k.fileName && <span className="text-xs font-medium text-slate-700">{k.fileName}</span>}
            <input type="file" accept=".txt,.md,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {fileErr && <p className="text-xs text-red-600">{fileErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div><div className="mb-1 text-sm font-medium">Judul</div><input className="input" value={k.title} onChange={(e) => setK({ ...k, title: e.target.value })} placeholder="mis. SOP Servis" /></div>
            <div><div className="mb-1 text-sm font-medium">Kategori</div><input className="input" value={k.category} onChange={(e) => setK({ ...k, category: e.target.value })} placeholder="FAQ / SOP / Produk" /></div>
          </div>
          <div><div className="mb-1 text-sm font-medium">Isi dokumen</div><textarea rows={12} className="input font-mono text-xs" value={k.answer} onChange={(e) => setK({ ...k, answer: e.target.value })} placeholder="Tempel isi FAQ/SOP di sini, atau upload file di atas. Pisahkan topik dengan baris kosong." /><p className="mt-1 text-xs text-slate-500">Akan dipotong menjadi {k.answer.trim() ? chunkDoc(k).length : 0} chunk.</p></div>
          <div><div className="mb-1 text-sm font-medium">Kata kunci tambahan (opsional)</div><input className="input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="sinonim / istilah lokal, pisahkan koma" /></div>
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
