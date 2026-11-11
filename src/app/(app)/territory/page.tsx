"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { normalizeCity, routeLead } from "@/lib/routing";
import { Forbidden, PageHeader } from "@/components/ui";
import type { Agent } from "@/lib/types";

const RULES = [
  "Pencocokan menggunakan kota/kabupaten atau alias yang sudah dimasukkan admin.",
  "Sistem tidak menebak kota terdekat atau memperluas wilayah tanpa persetujuan.",
  "Jika mapping tidak ditemukan, leads masuk Admin Queue dan tetap COLD.",
  "Jika agent tidak tersedia atau kapasitas penuh, default fallback: Admin Queue.",
  "WARM hanya setelah assignment resmi ke salah satu sales agent.",
];

export default function TerritoryPage() {
  const { agents, leads, user } = useStore();
  const [test, setTest] = useState("");
  if (!user || !can.manageTerritory(user.role)) return <Forbidden />;
  const r = test.trim() ? routeLead(test, agents, leads) : null;

  return (
    <>
      <PageHeader title="Routing Wilayah" desc="Mapping kota/kabupaten per sales territory. Exact match — tanpa inferensi geografis." />
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ Daftar kota di bawah adalah <b>contoh dummy</b>. Di project plan statusnya masih &ldquo;Belum ditentukan — Perlu dikonfirmasi&rdquo;.
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">{agents.map((a) => <TerritoryCard key={a.id} agent={a} />)}</div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Uji Routing</h2>
            <input className="input" placeholder="Ketik domisili, mis. Bekasi" value={test} onChange={(e) => setTest(e.target.value)} />
            {r && (
              <div className={`mt-3 rounded-lg p-3 text-sm ${r.kind === "assigned" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                {r.kind === "assigned" ? <>→ <b>{r.agent.name}</b> · lead menjadi WARM</> : <>→ <b>Admin Queue</b> (COLD)<br /><span className="text-xs">{r.reason}</span></>}
              </div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Aturan Routing</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">{RULES.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
        </div>
      </div>
    </>
  );
}

function TerritoryCard({ agent }: { agent: Agent }) {
  const { agents, updateAgent } = useStore();
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const add = () => {
    const c = v.trim();
    if (!c) return;
    const owner = agents.find((a) => a.cities.some((x) => normalizeCity(x) === normalizeCity(c)));
    if (owner) { setErr(`"${c}" sudah dipetakan ke ${owner.name}`); return; }
    updateAgent(agent.id, { cities: [...agent.cities, c] }, "Ubah territory mapping");
    setV(""); setErr("");
  };
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div><div className="font-semibold">{agent.name}</div><div className="text-xs text-slate-500">Wilayah utama: {agent.territory}</div></div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{agent.cities.length} kota/alias</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {agent.cities.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm">
            {c}
            <button aria-label={`Hapus ${c}`} className="rounded-full p-0.5 hover:bg-slate-300" onClick={() => updateAgent(agent.id, { cities: agent.cities.filter((x) => x !== c) }, "Ubah territory mapping")}><X size={12} /></button>
          </span>
        ))}
        {agent.cities.length === 0 && <span className="text-sm text-slate-400">Belum ada kota</span>}
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="input" placeholder="Tambah kota/kabupaten atau alias" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn-ghost shrink-0"><Plus size={16} /> Tambah</button>
      </form>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
