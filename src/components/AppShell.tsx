"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, MessageSquare, Inbox, UserCog, FlaskConical, BarChart3, BookOpen,
  ScrollText, KeyRound, ClipboardList, Menu, X, LogOut, RotateCcw,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/permissions";

/** agent: true = menu juga tersedia untuk role Agent. Selain itu khusus Admin. */
const NAV: { href: string; label: string; icon: React.ElementType; agent?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare, agent: true },
  { href: "/leads", label: "Leads", icon: Users, agent: true },
  { href: "/queue", label: "Admin Queue", icon: Inbox },
  { href: "/agents", label: "Kelola Agent", icon: UserCog },
  { href: "/knowledge", label: "Knowledge Chatbot", icon: BookOpen },
  { href: "/simulator", label: "Simulator", icon: FlaskConical },
  { href: "/reports", label: "Laporan", icon: BarChart3 },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/integrations", label: "Integrasi", icon: KeyRound },
  { href: "/project", label: "Project Plan", icon: ClipboardList },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout, reset, leads } = useStore();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const allowed = user?.role === "admin" || NAV.some((n) => n.agent && path.startsWith(n.href));
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/");
    else if (!allowed) router.replace("/inbox");
  }, [ready, user, allowed, router]);
  useEffect(() => { setOpen(false); }, [path]);

  if (!ready || !user || !allowed) return <div className="grid h-screen place-items-center text-sm text-slate-400">Memuat…</div>;

  const queueCount = leads.filter((l) => l.inQueue).length;

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.filter((n) => user.role === "admin" || n.agent).map((n) => {
        const active = path.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}>
            <Icon size={18} />
            <span className="flex-1">{n.label}</span>
            {n.href === "/queue" && queueCount > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-white">{queueCount}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {user.role === "admin" && <Footer onReset={reset} />}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-3"><Brand /><button onClick={() => setOpen(false)} aria-label="Tutup menu"><X size={20} /></button></div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {user.role === "admin" && <Footer onReset={reset} />}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu size={20} /></button>
          <span className="hidden rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 sm:inline">MODE DEMO · data dummy</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold">{user.name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}{user.territory ? ` · ${user.territory}` : ""}</div>
            </div>
            <button onClick={() => { logout(); router.replace("/"); }} className="btn-ghost px-2" title="Logout"><LogOut size={16} /></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-5 py-4">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white">D</div>
      <div className="leading-tight">
        <div className="text-sm font-bold">DIPO Lead CRM</div>
        <div className="text-[11px] text-slate-500">AI WhatsApp Lead Mgmt</div>
      </div>
    </div>
  );
}

function Footer({ onReset }: { onReset: () => void }) {
  return (
    <div className="border-t border-slate-200 p-3">
      <button onClick={() => confirm("Reset semua data demo ke kondisi awal?") && onReset()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-100">
        <RotateCcw size={14} /> Reset data demo
      </button>
    </div>
  );
}
