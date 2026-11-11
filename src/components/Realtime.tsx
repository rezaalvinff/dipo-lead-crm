"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Lead, LeadSource } from "@/lib/types";

type Meta = Partial<Pick<Lead, "profileName" | "adId" | "adHeadline" | "sourceUrl" | "ctwaClid" | "campaign">>;
interface Script { source: LeadSource; meta: Meta; lines: string[] }

/** Percakapan contoh yang "masuk" otomatis di mode demo, meniru webhook + WebSocket. */
const SCRIPTS: Script[] = [
  { source: "Meta Ads", meta: { profileName: "Andi", adId: "120231111", adHeadline: "Xforce — Test Drive Sekarang", sourceUrl: "https://fb.me/dipo-mitsubishi-ads", ctwaClid: "ARAkLxDemo1", campaign: "CTWA - Xforce Launch" }, lines: ["Halo kak, saya lihat iklan Xforce. Ada promo bulan ini?", "Saya Andi Saputra", "Di Bekasi", "Xforce kak"] },
  { source: "WhatsApp Organic", meta: { profileName: "Siti" }, lines: ["Permisi, bisa kredit gak? Dokumennya apa saja?", "Nama saya Siti Rahma", "Medan", "Xpander Cross"] },
  { source: "Google Ads", meta: { profileName: "Gilang" }, lines: ["Siang, test drive bisa di rumah gak?", "Saya Gilang dari Cirebon, mau Pajero Sport"] },
  { source: "Meta Ads", meta: { profileName: "Bambang", adId: "120233333", adHeadline: "Pajero Sport DP Ringan", sourceUrl: "https://fb.me/dipo-mitsubishi-ads", ctwaClid: "ARAkLxDemo2", campaign: "CTWA - Pajero Sport Retargeting" }, lines: ["Jam buka showroom sampai jam berapa?", "Saya Bambang", "Pekanbaru", "Triton double cabin"] },
  { source: "Google Organic", meta: { profileName: "Rina" }, lines: ["Halo, bedanya Xpander sama Xpander Cross apa ya?", "Saya Rina dari Depok", "Masih belum tahu"] },
];

const PREF = "dipo-realtime-demo";

export function useRealtimeDemo() {
  const [on, setOn] = useState(true);
  useEffect(() => { try { setOn(localStorage.getItem(PREF) !== "off"); } catch {} }, []);
  const toggle = () => setOn((v) => { try { localStorage.setItem(PREF, v ? "off" : "on"); } catch {} return !v; });
  return { on, toggle };
}

export function RealtimeEngine({ on }: { on: boolean }) {
  const { live, simulateInbound, user } = useStore();
  const st = useRef({ script: Math.floor(Math.random() * SCRIPTS.length), line: 0, phone: "" });
  const sim = useRef(simulateInbound);
  sim.current = simulateInbound;
  const loggedIn = Boolean(user);
  useEffect(() => {
    if (live || !on || !loggedIn) return;
    const tick = () => {
      const s = st.current;
      const sc = SCRIPTS[s.script % SCRIPTS.length];
      if (s.line === 0) s.phone = `+62 81${Math.floor(Math.random() * 9)} ${Math.floor(1000 + Math.random() * 8999)} ${Math.floor(1000 + Math.random() * 8999)}`;
      void sim.current(s.phone, sc.lines[s.line], sc.source, sc.meta);
      s.line++;
      if (s.line >= sc.lines.length) { s.script++; s.line = 0; }
    };
    const first = setTimeout(tick, 6000);
    const t = setInterval(tick, 14000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [live, on, loggedIn]);
  return null;
}

/** Toast saat ada pesan pelanggan baru (mode demo & live). */
export function Toasts() {
  return <Suspense><ToastsInner /></Suspense>;
}

function ToastsInner() {
  const { visibleLeads, messages } = useStore();
  const path = usePathname();
  const openLead = useSearchParams().get("lead");
  const seen = useRef<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; leadId: string; name: string; text: string }[]>([]);

  useEffect(() => {
    const ids = new Set(visibleLeads.map((l) => l.id));
    const last = [...messages].reverse().find((m) => m.from === "customer" && ids.has(m.leadId));
    if (!last) return;
    if (seen.current === null) { seen.current = last.id; return; }
    if (last.id === seen.current) return;
    seen.current = last.id;
    if (path.startsWith("/inbox") && openLead === last.leadId) return;
    const lead = visibleLeads.find((l) => l.id === last.leadId);
    const toast = { id: last.id, leadId: last.leadId, name: lead?.name ?? lead?.profileName ?? lead?.phone ?? "Pelanggan", text: last.text };
    setToasts((t) => [...t.slice(-2), toast]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), 5000);
  }, [messages, visibleLeads, path, openLead]);

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><MessageCircle size={16} /></div>
          <Link href={`/inbox?lead=${t.leadId}`} className="min-w-0 flex-1" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
            <div className="text-sm font-semibold">{t.name}</div>
            <div className="truncate text-xs text-slate-500">{t.text}</div>
          </Link>
          <button aria-label="Tutup" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><X size={14} className="text-slate-400" /></button>
        </div>
      ))}
    </div>
  );
}
