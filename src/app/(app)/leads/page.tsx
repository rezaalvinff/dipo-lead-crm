"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { LEAD_SOURCES } from "@/lib/types";
import { Empty, PageHeader, SourceBadge, StatusBadge } from "@/components/ui";
import { fmtTime } from "@/lib/format";

export default function LeadsPage() {
  const { visibleLeads, agents, userById: agentById, user } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [agent, setAgent] = useState("");

  const rows = useMemo(() => visibleLeads.filter((l) => {
    if (status === "QUEUE" ? !l.inQueue : status && l.status !== status) return false;
    if (source && l.source !== source) return false;
    if (agent && l.agentId !== agent) return false;
    const s = q.toLowerCase();
    return !s || [l.id, l.name, l.phone, l.city, l.unit].some((x) => x?.toLowerCase().includes(s));
  }), [visibleLeads, q, status, source, agent]);

  const exportCsv = () => {
    const head = ["ID", "Nama", "Nomor", "Domisili", "Unit", "Sumber", "Status", "Agent", "Masuk"];
    const body = rows.map((l) => [l.id, l.name ?? "", l.phone, l.city ?? "", l.unit ?? "", l.source, l.status, agentById(l.agentId)?.name ?? "", new Date(l.createdAt).toISOString()]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "leads-dipo.csv";
    a.click();
  };

  return (
    <>
      <PageHeader title="Leads" desc={user?.role === "agent" ? "Leads yang ditugaskan ke Anda" : "Seluruh leads dari semua sumber"}>
        <button className="btn-ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>
      </PageHeader>

      <div className="card mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option><option value="COLD">COLD (belum lengkap)</option><option value="WARM">WARM (lengkap)</option><option value="QUEUE">Admin Queue</option></select>
        <select className="input" value={source} onChange={(e) => setSource(e.target.value)}><option value="">Semua sumber</option>{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        {user?.role === "admin" && <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)}><option value="">Semua agent</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr>{["Lead", "Domisili", "Unit", "Sumber", "Status", "Agent", "Masuk"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="td"><Link href={`/inbox?lead=${l.id}`} className="font-medium text-slate-900 hover:text-brand-600">{l.name ?? <span className="italic text-slate-400">belum diketahui</span>}</Link><div className="text-xs text-slate-500">{l.id} · {l.phone}</div></td>
                <td className="td">{l.city ?? "—"}</td>
                <td className="td">{l.unit ?? "—"}</td>
                <td className="td"><SourceBadge source={l.source} /></td>
                <td className="td"><StatusBadge status={l.status} inQueue={l.inQueue} />{l.aiActive && <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">AI</span>}</td>
                <td className="td">{agentById(l.agentId)?.name ?? "—"}</td>
                <td className="td whitespace-nowrap text-slate-500">{fmtTime(l.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty text="Tidak ada leads sesuai filter" />}
      </div>
      <p className="mt-2 text-xs text-slate-400">{rows.length} leads</p>
    </>
  );
}
