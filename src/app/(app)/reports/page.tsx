"use client";

import { useStore } from "@/lib/store";
import { LEAD_SOURCES } from "@/lib/types";
import { UNIT_MODELS } from "@/lib/ai";
import { Bar, PageHeader } from "@/components/ui";

export default function ReportsPage() {
  const { visibleLeads: leads, agents, messages, user } = useStore();
  const isSales = user?.role === "sales";
  const shownAgents = isSales ? agents.filter((a) => a.id === user?.agentId) : agents;

  const bySource = LEAD_SOURCES.map((s) => {
    const ls = leads.filter((l) => l.source === s);
    return { s, total: ls.length, warm: ls.filter((l) => l.status === "WARM").length, cold: ls.filter((l) => l.status === "COLD").length };
  });
  const byUnit = [...UNIT_MODELS, "Belum tahu"].map((u) => ({ u, n: leads.filter((l) => l.unit === u).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
  const maxU = Math.max(...byUnit.map((x) => x.n), 1);

  return (
    <>
      <PageHeader title="Laporan" desc="Sumber leads, performa sales, dan minat unit. Sumber tidak diketahui ditandai Unknown — tidak ditebak." />

      <div className="card mb-6 overflow-x-auto">
        <div className="p-5 pb-2 font-semibold">Laporan Sumber Leads</div>
        <table className="w-full min-w-[500px]">
          <thead className="border-y border-slate-200 bg-slate-50"><tr>{["Sumber", "Total", "WARM", "COLD", "% WARM"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {bySource.map((r) => (
              <tr key={r.s}><td className="td font-medium">{r.s}</td><td className="td tabular-nums">{r.total}</td><td className="td tabular-nums">{r.warm}</td><td className="td tabular-nums">{r.cold}</td><td className="td tabular-nums">{r.total ? Math.round((r.warm / r.total) * 100) : 0}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <div className="p-5 pb-2 font-semibold">Laporan Sales</div>
          <table className="w-full min-w-[500px]">
            <thead className="border-y border-slate-200 bg-slate-50"><tr>{["Sales", "Ditugaskan", "Sudah dibalas", "Belum dibalas", "Pesan terkirim"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {shownAgents.map((a) => {
                const ls = leads.filter((l) => l.agentId === a.id);
                const replied = ls.filter((l) => messages.some((m) => m.leadId === l.id && m.from === "agent")).length;
                const sent = messages.filter((m) => m.from === "agent" && ls.some((l) => l.id === m.leadId)).length;
                return <tr key={a.id}><td className="td font-medium">{a.name}</td><td className="td tabular-nums">{ls.length}</td><td className="td tabular-nums">{replied}</td><td className="td tabular-nums text-brand-600">{ls.length - replied}</td><td className="td tabular-nums">{sent}</td></tr>;
              })}
            </tbody>
          </table>
          <p className="px-5 py-3 text-xs text-slate-400">Definisi metrik final perlu disepakati sebelum produksi (FR-024).</p>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Minat Unit</h2>
          <div className="space-y-3">{byUnit.map(({ u, n }) => <Bar key={u} label={u} value={n} max={maxU} color="bg-slate-700" />)}</div>
        </div>
      </div>
    </>
  );
}
