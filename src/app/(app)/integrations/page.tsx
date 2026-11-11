"use client";

import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { Forbidden, PageHeader } from "@/components/ui";

const ITEMS = [
  { name: "Meta WhatsApp Cloud API", phase: "Phase 7", env: ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_VERIFY_TOKEN", "META_APP_SECRET"], desc: "Webhook HTTPS, verifikasi signature, inbound/outbound, status, template, 24-hour window." },
  { name: "AI API (kualifikasi)", phase: "Phase 2", env: ["AI_API_KEY", "AI_MODEL"], desc: "Ekstraksi nama, domisili, unit. Saat ini memakai mock rule-based di browser." },
  { name: "Meta Conversions API", phase: "Phase 8", env: ["META_PIXEL_OR_DATASET_ID", "META_CAPI_TOKEN"], desc: "Event kualitas leads — validasi consent, deduplication, eligibility." },
  { name: "Database (PostgreSQL)", phase: "Phase 2", env: ["DATABASE_URL"], desc: "Penyimpanan kontak, leads, percakapan, assignment, audit." },
];

export default function IntegrationsPage() {
  const { user } = useStore();
  if (!user || !can.manageIntegrations(user.role)) return <Forbidden />;
  return (
    <>
      <PageHeader title="Integrasi" desc="Hanya Super Admin. Kredensial disimpan di environment variables / secret manager — tidak pernah ditampilkan di UI atau disimpan di repository." />
      <div className="grid gap-4 md:grid-cols-2">
        {ITEMS.map((i) => (
          <div key={i.name} className="card p-5">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">{i.name}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Belum terhubung</span></div>
            <p className="mb-3 text-sm text-slate-500">{i.desc}</p>
            <div className="mb-2 text-xs font-semibold text-slate-500">Env vars yang dibutuhkan ({i.phase})</div>
            <ul className="space-y-1">{i.env.map((e) => <li key={e} className="flex justify-between rounded bg-slate-50 px-2 py-1 font-mono text-xs"><span>{e}</span><span className="text-slate-400">•••• not set</span></li>)}</ul>
          </div>
        ))}
      </div>
    </>
  );
}
