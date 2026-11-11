"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { activeLoad } from "@/lib/routing";
import type { Lead } from "@/lib/types";

export default function AssignControl({ lead, compact }: { lead: Lead; compact?: boolean }) {
  const { agents, leads, assignLead } = useStore();
  const [sel, setSel] = useState(lead.agentId ?? "");
  return (
    <div className={`flex gap-2 ${compact ? "" : "flex-col sm:flex-row"}`}>
      <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">Pilih sales…</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {activeLoad(a.id, leads)}/{a.capacity}{a.available ? "" : " · tidak tersedia"}
          </option>
        ))}
      </select>
      <button className="btn-primary shrink-0" disabled={!sel || sel === lead.agentId} onClick={() => assignLead(lead.id, sel)}>
        {lead.agentId ? "Reassign" : "Assign"}
      </button>
    </div>
  );
}
