"use client";

import { useStore } from "@/lib/store";
import { fmtTime } from "@/lib/format";
import { PageHeader } from "@/components/ui";

export default function AuditPage() {
  const { audit } = useStore();
  return (
    <>
      <PageHeader title="Audit Log" desc="Login, assignment, perubahan territory, availability, dan tindakan admin (FR-027)." />
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr>{["Waktu", "Actor", "Action", "Target", "Detail"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {audit.slice(0, 200).map((a) => (
              <tr key={a.id}><td className="td whitespace-nowrap text-slate-500">{fmtTime(a.at)}</td><td className="td">{a.actor}</td><td className="td font-medium">{a.action}</td><td className="td">{a.target}</td><td className="td text-slate-500">{a.detail}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
