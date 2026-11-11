"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useStore } from "@/lib/store";

const DEMO = [
  { role: "Admin", u: "admin", p: "admin123" },
  { role: "Agent Jakarta", u: "jakarta", p: "agent123" },
  { role: "Agent Medan", u: "medan", p: "agent123" },
];

export default function LoginPage() {
  const { login, user, ready } = useStore();
  const router = useRouter();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (ready && user) router.replace(user.role === "admin" ? "/dashboard" : "/inbox");
  }, [ready, user, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = login(u, p);
    if (!r.ok) setErr(r.error);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-lg font-black text-white">D</div>
            <div>
              <h1 className="text-lg font-bold">DIPO Lead CRM</h1>
              <p className="text-sm text-slate-500">Masuk ke akun Anda</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="u" className="mb-1 block text-sm font-medium">Username</label>
              <input id="u" className="input" autoComplete="username" value={u} onChange={(e) => { setU(e.target.value); setErr(""); }} autoFocus />
            </div>
            <div>
              <label htmlFor="p" className="mb-1 block text-sm font-medium">Password</label>
              <div className="relative">
                <input id="p" type={show ? "text" : "password"} className="input pr-10" autoComplete="current-password" value={p} onChange={(e) => { setP(e.target.value); setErr(""); }} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-2.5 text-slate-400" aria-label="Tampilkan password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
            <button className="btn-primary w-full py-2.5" disabled={!u || !p}><LogIn size={16} /> Masuk</button>
          </form>
        </div>

        <div className="mt-4 rounded-xl bg-white/10 p-4 text-xs text-white/90 backdrop-blur">
          <div className="mb-2 font-semibold">Akun demo (klik untuk isi otomatis)</div>
          <div className="space-y-1">
            {DEMO.map((d) => (
              <button key={d.u} onClick={() => { setU(d.u); setP(d.p); setErr(""); }} className="flex w-full justify-between rounded-md px-2 py-1 text-left hover:bg-white/10">
                <span>{d.role}</span><span className="font-mono">{d.u} / {d.p}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
