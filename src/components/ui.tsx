import type { LeadStatus } from "@/lib/types";

export function StatusBadge({ status, inQueue }: { status: LeadStatus; inQueue?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status === "WARM" ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700"}`}>{status}</span>
      {inQueue && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Queue</span>}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const c: Record<string, string> = {
    "Meta Ads": "bg-blue-50 text-blue-700",
    "Google Ads": "bg-emerald-50 text-emerald-700",
    "Google Organic": "bg-lime-50 text-lime-700",
    "WhatsApp Organic": "bg-green-50 text-green-700",
    Unknown: "bg-slate-100 text-slate-600",
  };
  return <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ${c[source] ?? c.Unknown}`}>{source}</span>;
}

export function PageHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {desc && <p className="mt-1 text-sm text-slate-500">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="p-10 text-center text-sm text-slate-400">{text}</div>;
}

export function Forbidden() {
  return <div className="card p-10 text-center text-sm text-slate-500">Halaman ini tidak tersedia untuk role Anda.</div>;
}

export function Bar({ label, value, max, color = "bg-brand-500" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span className="text-slate-600">{label}</span><span className="font-semibold tabular-nums">{value}</span></div>
      <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
