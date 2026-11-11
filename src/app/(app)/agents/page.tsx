"use client";

import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { activeLoad } from "@/lib/routing";
import { Forbidden, PageHeader } from "@/components/ui";

export default function AgentsPage() {
  const { agents, leads, user, updateAgent } = useStore();
  if (!user || !can.manageAvailability(user.role)) return <Forbidden />;

  return (
    <>
      <PageHeader title="Sales Agent" desc="Atur ketersediaan dan kapasitas. Routing otomatis menghormati konfigurasi ini; jika penuh/tidak tersedia → Admin Queue." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((a) => {
          const load = activeLoad(a.id, leads);
          const total = leads.filter((l) => l.agentId === a.id).length;
          return (
            <div key={a.id} className="card p-5">
              <div className="mb-4 flex items-start justify-between">
                <div><div className="font-semibold">{a.name}</div><div className="text-xs text-slate-500">Wilayah {a.territory}</div></div>
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <span className={a.available ? "text-emerald-600" : "text-slate-400"}>{a.available ? "Tersedia" : "Tidak tersedia"}</span>
                  <input type="checkbox" className="peer sr-only" checked={a.available} onChange={(e) => updateAgent(a.id, { available: e.target.checked }, "Ubah availability")} />
                  <span className="relative h-5 w-9 rounded-full bg-slate-300 transition after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-emerald-500 peer-checked:after:translate-x-4" />
                </label>
              </div>
              <div className="mb-1 flex justify-between text-sm"><span className="text-slate-500">Leads aktif (WARM)</span><span className="font-semibold tabular-nums">{load}/{a.capacity}</span></div>
              <div className="mb-4 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${load >= a.capacity ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, (load / a.capacity) * 100)}%` }} /></div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <label htmlFor={`cap-${a.id}`} className="text-slate-500">Kapasitas maks.</label>
                <input id={`cap-${a.id}`} type="number" min={0} className="input w-24" value={a.capacity} onChange={(e) => updateAgent(a.id, { capacity: Math.max(0, Number(e.target.value)) }, "Ubah kapasitas")} />
              </div>
              <div className="mt-3 text-xs text-slate-400">Total pernah ditugaskan: {total}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
