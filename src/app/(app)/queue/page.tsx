"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageSquare, Pencil } from "lucide-react";
import { useStore } from "@/lib/store";
import { Empty, PageHeader, SourceBadge, StatusBadge } from "@/components/ui";
import AssignControl from "@/components/AssignControl";
import { timeAgo } from "@/lib/format";
import type { LeadV } from "@/lib/store";

export default function QueuePage() {
  const { leads } = useStore();
  const queue = leads.filter((l) => l.inQueue).sort((a, b) => a.createdAt - b.createdAt);

  return (
    <>
      <PageHeader title="Admin Queue" desc="Leads yang domisilinya belum terdaftar di wilayah agent mana pun. Assign manual ke agent, atau tambahkan domisilinya di menu Kelola Agent." />
      {queue.length === 0 ? <div className="card"><Empty text="Antrean kosong 🎉" /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{queue.map((l) => <QueueCard key={l.id} lead={l} />)}</div>
      )}
    </>
  );
}

function QueueCard({ lead }: { lead: LeadV }) {
  const { updateLead, bot } = useStore();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: lead.name ?? "", city: lead.city ?? "", unit: lead.unit ?? "" });

  return (
    <div className="card flex flex-col p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div><div className="font-semibold">{lead.name ?? lead.phone}</div><div className="text-xs text-slate-500">{lead.id} · {lead.phone}</div></div>
        <div className="flex flex-col items-end gap-1"><StatusBadge status={lead.status} /><SourceBadge source={lead.source} /></div>
      </div>
      <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{lead.queueReason}</div>
      {edit ? (
        <div className="mb-3 space-y-2">
          <input className="input" placeholder="Nama" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className="input" placeholder="Kota/kabupaten" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          <select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}><option value="">Unit…</option>{[...bot.units, "Belum tahu"].map((u) => <option key={u}>{u}</option>)}</select>
          <div className="flex gap-2"><button className="btn-primary" onClick={() => { updateLead(lead.id, f); setEdit(false); }}>Simpan</button><button className="btn-ghost" onClick={() => setEdit(false)}>Batal</button></div>
        </div>
      ) : (
        <dl className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-slate-500">Domisili</dt><dd className="font-medium">{lead.city ?? "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Unit</dt><dd className="font-medium">{lead.unit ?? "—"}</dd></div>
          <div className="col-span-2 text-xs text-slate-400">Masuk {timeAgo(lead.createdAt)}</div>
        </dl>
      )}
      <div className="mt-auto space-y-2">
        <AssignControl lead={lead} compact />
        <div className="flex gap-2">
          <Link href={`/inbox?lead=${lead.id}`} className="btn-ghost flex-1"><MessageSquare size={14} /> Chat</Link>
          {!edit && <button className="btn-ghost flex-1" onClick={() => setEdit(true)}><Pencil size={14} /> Lengkapi data</button>}
        </div>
      </div>
    </div>
  );
}
