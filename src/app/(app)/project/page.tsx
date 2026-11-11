"use client";

import { useState } from "react";
import data from "@/lib/project-data.json";
import { PageHeader } from "@/components/ui";

type Row = Record<string, string>;

/** FR yang sudah bisa dicoba di prototype frontend ini (dengan data/AI mock). */
const IN_PROTOTYPE = new Set(["FR-004", "FR-005", "FR-006", "FR-007", "FR-008", "FR-009", "FR-010", "FR-011", "FR-012", "FR-013", "FR-014", "FR-015", "FR-016", "FR-017", "FR-018", "FR-019", "FR-021", "FR-022", "FR-023", "FR-024", "FR-026", "FR-027"]);

const TABS: { key: keyof typeof data; label: string; cols?: string[] }[] = [
  { key: "roadmap", label: "Roadmap", cols: ["Phase", "Nama tahap", "Ruang lingkup utama", "Estimasi durasi", "Prioritas", "Gate / syarat lanjut"] },
  { key: "features", label: "Daftar Fitur", cols: ["ID", "Modul", "Fitur", "Deskripsi kebutuhan", "Prioritas", "Tahap target"] },
  { key: "timeline", label: "Timeline", cols: ["Phase", "Aktivitas", "PIC", "Dependensi / catatan", "Status"] },
  { key: "uat", label: "UAT Checklist", cols: ["ID", "Area", "Skenario uji", "Hasil yang diharapkan", "Status"] },
  { key: "risks", label: "Risiko", cols: ["ID", "Risiko / dependensi", "Dampak potensial", "Mitigasi / tindakan", "Prioritas"] },
  { key: "roles", label: "Role & Akses" },
  { key: "cost", label: "Estimasi Biaya", cols: ["Komponen", "Dasar perhitungan", "Biaya variabel", "Catatan / sumber angka"] },
];

const pill = (v: string) => {
  const c =
    /Kritis|Must have/.test(v) ? "bg-red-100 text-red-700" :
    /Tinggi|Should have/.test(v) ? "bg-amber-100 text-amber-800" :
    /^Ya$/.test(v) ? "bg-emerald-100 text-emerald-700" :
    /^Tidak$/.test(v) ? "bg-slate-100 text-slate-500" :
    /Terbatas|Opsional|jika/.test(v) ? "bg-sky-100 text-sky-700" :
    /Belum/.test(v) ? "bg-slate-100 text-slate-600" : "";
  return c ? <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{v}</span> : v;
};

export default function ProjectPage() {
  const [tab, setTab] = useState(TABS[0]);
  const rows = data[tab.key] as Row[];
  const cols = tab.cols ?? Object.keys(rows[0] ?? {});
  const isFeatures = tab.key === "features";

  return (
    <>
      <PageHeader title="Project Plan" desc="Ringkasan dari workbook Project Plan AI WhatsApp Lead Management DIPO v1.0 (rancangan target)." />
      {tab.key === "roadmap" && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="card p-4"><div className="text-2xl font-bold">12–21 minggu</div><div className="text-xs text-slate-500">Estimasi total indikatif (bukan komitmen tanggal)</div></div>
          <div className="card p-4"><div className="text-2xl font-bold">9 phase</div><div className="text-xs text-slate-500">Discovery → UAT & go-live</div></div>
          <div className="card p-4"><div className="text-2xl font-bold">{IN_PROTOTYPE.size}/{data.features.filter((f) => f.ID.startsWith("FR")).length} FR</div><div className="text-xs text-slate-500">Bisa dicoba di prototype ini (mock)</div></div>
        </div>
      )}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => <button key={t.key} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${t.key === tab.key ? "bg-slate-800 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{t.label}</button>)}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-slate-200 bg-slate-50"><tr>{cols.map((c) => <th key={c} className="th">{c}</th>)}{isFeatures && <th className="th">Prototype</th>}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                {cols.map((c) => <td key={c} className={`td ${c === cols[0] ? "whitespace-nowrap font-medium" : ""}`}>{pill(r[c] ?? "")}</td>)}
                {isFeatures && <td className="td">{IN_PROTOTYPE.has(r.ID) ? <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Bisa dicoba</span> : <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Butuh backend</span>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
