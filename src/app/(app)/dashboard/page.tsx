"use client";

import Link from "next/link";
import { Users, Snowflake, Flame, Inbox, Bot } from "lucide-react";
import { useStore } from "@/lib/store";
import { LEAD_SOURCES } from "@/lib/types";
import { Bar, PageHeader, SourceBadge, StatusBadge } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export default function Dashboard() {
  const { leads, agents, userById: agentById } = useStore();
  const isSales = false;
  const kpi = [
    { label: "Total Leads", value: leads.length, icon: Users, c: "text-slate-700 bg-slate-100" },
    { label: "COLD (data belum lengkap)", value: leads.filter((l) => l.status === "COLD").length, icon: Snowflake, c: "text-sky-700 bg-sky-100" },
    { label: "WARM (data lengkap)", value: leads.filter((l) => l.status === "WARM").length, icon: Flame, c: "text-orange-700 bg-orange-100" },
    { label: "Admin Queue", value: leads.filter((l) => l.inQueue).length, icon: Inbox, c: "text-amber-700 bg-amber-100" },
    { label: "AI Kualifikasi", value: leads.filter((l) => l.aiActive).length, icon: Bot, c: "text-violet-700 bg-violet-100" },
  ];

  const bySource = LEAD_SOURCES.map((s) => ({ s, n: leads.filter((l) => l.source === s).length }));
  const maxS = Math.max(...bySource.map((x) => x.n), 1);

  return (
    <>
      <PageHeader title="Dashboard" desc="Ringkasan seluruh leads, status, dan agent" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpi.map((k) => (
          <div key={k.label} className="card p-4">
            <div className={`mb-3 inline-grid h-9 w-9 place-items-center rounded-lg ${k.c}`}><k.icon size={18} /></div>
            <div className="text-2xl font-bold tabular-nums">{k.value}</div>
            <div className="text-xs text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {!isSales && (
          <div className="card p-5">
            <h2 className="mb-4 font-semibold">Leads per Agent</h2>
            <div className="space-y-4">
              {agents.map((a) => (
                <Bar key={a.id} label={`${a.name} · ${a.territory}`} value={leads.filter((l) => l.agentId === a.id).length} max={Math.max(...agents.map((x) => leads.filter((l) => l.agentId === x.id).length), 1)} color="bg-slate-700" />
              ))}
            </div>
          </div>
        )}

        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Sumber Leads</h2>
          <div className="space-y-4">{bySource.map(({ s, n }) => <Bar key={s} label={s} value={n} max={maxS} />)}</div>
        </div>

        <div className={`card overflow-hidden ${isSales ? "lg:col-span-2" : ""}`}>
          <div className="flex items-center justify-between p-5 pb-3"><h2 className="font-semibold">Aktivitas Terbaru</h2><Link href="/leads" className="text-xs font-medium text-brand-600">Lihat semua</Link></div>
          <ul className="divide-y divide-slate-100">
            {leads.slice(0, 7).map((l) => (
              <li key={l.id}>
                <Link href={`/inbox?lead=${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.name ?? l.phone}</div>
                    <div className="truncate text-xs text-slate-500">{l.city ?? "—"} · {l.unit ?? "—"} · {agentById(l.agentId)?.name ?? "Belum ada agent"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={l.status} inQueue={l.inQueue} />
                    <span className="text-[11px] text-slate-400">{timeAgo(l.lastCustomerMsgAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!isSales && (
        <div className="mt-6 card p-5">
          <h2 className="mb-1 font-semibold">Alur Leads</h2>
          <p className="mb-4 text-xs text-slate-500">Dari sheet &ldquo;Alur Operasional&rdquo;</p>
          <ol className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
            {["Pelanggan chat ke WA pusat", "Identifikasi sumber", "AI kumpulkan nama, domisili, unit (COLD)", "Data lengkap → WARM, AI handover", "Cocokkan domisili dengan wilayah agent", "Auto-assign ke agent / Admin Queue"].map((t, i) => (
              <li key={t} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="mb-1 block font-bold text-brand-600">{i + 1}</span>{t}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2"><SourceBadge source="Meta Ads" /><SourceBadge source="Google Ads" /><SourceBadge source="Google Organic" /><SourceBadge source="WhatsApp Organic" /><SourceBadge source="Unknown" /></div>
        </div>
      )}
    </>
  );
}
