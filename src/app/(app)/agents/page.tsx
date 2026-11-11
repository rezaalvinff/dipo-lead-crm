"use client";

import { useState } from "react";
import { Check, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLE_ACCESS, ROLE_LABEL } from "@/lib/permissions";
import { routeLead } from "@/lib/routing";
import { PageHeader } from "@/components/ui";
import type { Role, User } from "@/lib/types";

const blank = (): User => ({ id: `u-${Math.random().toString(36).slice(2, 8)}`, name: "", username: "", password: "", role: "agent", active: true, territory: "", cities: [] });

export default function AgentsPage() {
  const { users, leads, user: me, deleteUser } = useStore();
  const [editing, setEditing] = useState<User | null>(null);
  const [test, setTest] = useState("");
  const r = test.trim() ? routeLead(test, users) : null;

  return (
    <>
      <PageHeader title="Kelola Agent" desc="Tambah agent, atur akses (Admin / Agent), wilayah, dan daftar domisili yang otomatis diteruskan ke agent tersebut.">
        <button className="btn-primary" onClick={() => setEditing(blank())}><Plus size={16} /> Tambah user</button>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {users.map((u) => {
            const count = leads.filter((l) => l.agentId === u.id).length;
            return (
              <div key={u.id} className={`card p-4 ${u.active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200 font-semibold text-slate-600">{u.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{u.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.role === "admin" ? "bg-slate-800 text-white" : "bg-brand-50 text-brand-700"}`}>{ROLE_LABEL[u.role]}</span>
                      {u.territory && <span className="text-sm text-slate-500">· Wilayah {u.territory}</span>}
                      {!u.active && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">Nonaktif</span>}
                    </div>
                    <div className="text-xs text-slate-500">@{u.username}{u.role === "agent" ? ` · ${count} leads` : ""}</div>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-ghost px-2" onClick={() => setEditing({ ...u, cities: [...u.cities] })} aria-label="Edit"><Pencil size={14} /></button>
                    {u.id !== me?.id && <button className="btn-ghost px-2 text-red-600" aria-label="Hapus" onClick={() => confirm(`Hapus ${u.name}?${count ? ` ${count} leads miliknya akan dipindah ke Admin Queue.` : ""}`) && deleteUser(u.id)}><Trash2 size={14} /></button>}
                  </div>
                </div>
                {u.role === "agent" && (
                  <div className="mt-3 flex flex-wrap gap-1.5 pl-[52px]">
                    {u.cities.length ? u.cities.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs"><MapPin size={10} />{c}</span>) : <span className="text-xs text-amber-700">Belum ada domisili — lead tidak akan auto-assign ke agent ini</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="mb-1 font-semibold">Uji auto-assign</h2>
            <p className="mb-3 text-xs text-slate-500">Ketik domisili pelanggan untuk melihat diteruskan ke agent mana.</p>
            <div className="relative"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="mis. Karawang" value={test} onChange={(e) => setTest(e.target.value)} /></div>
            {r && <div className={`mt-3 rounded-lg p-3 text-sm ${r.kind === "assigned" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{r.kind === "assigned" ? <>→ <b>{r.agent.name}</b> (Wilayah {r.agent.territory})</> : <>→ <b>Admin Queue</b><br /><span className="text-xs">{r.reason}</span></>}</div>}
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-semibold">Hak akses role</h2>
            {(["admin", "agent"] as Role[]).map((role) => (
              <div key={role} className="mb-3 last:mb-0">
                <div className="mb-1 text-sm font-semibold">{ROLE_LABEL[role]}</div>
                <ul className="space-y-0.5 text-xs text-slate-600">{ROLE_ACCESS[role].map((a) => <li key={a} className="flex gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-emerald-600" />{a}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && <UserForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function UserForm({ initial, onClose }: { initial: User; onClose: () => void }) {
  const { users, saveUser } = useStore();
  const isNew = !users.some((u) => u.id === initial.id);
  const [u, setU] = useState<User>(initial);
  const [city, setCity] = useState("");
  const [err, setErr] = useState("");
  const set = (p: Partial<User>) => { setU({ ...u, ...p }); setErr(""); };

  const addCities = (raw: string) => {
    const list = raw.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean).filter((c) => !u.cities.some((y) => y.toLowerCase() === c.toLowerCase()));
    if (list.length) set({ cities: [...u.cities, ...list] });
    setCity("");
  };

  const save = () => {
    const r = saveUser(u);
    if (r.ok) onClose(); else setErr(r.error);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold">{isNew ? "Tambah user" : `Edit ${initial.name}`}</h2>
          <button onClick={onClose} aria-label="Tutup"><X size={20} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Field label="Nama"><input className="input" value={u.name} onChange={(e) => set({ name: e.target.value })} placeholder="mis. Dewi" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username"><input className="input" value={u.username} onChange={(e) => set({ username: e.target.value.replace(/\s/g, "") })} /></Field>
            <Field label="Password"><input className="input" value={u.password} onChange={(e) => set({ password: e.target.value })} placeholder="min. 6 karakter" /></Field>
          </div>

          <Field label="Akses (role)">
            <div className="grid grid-cols-2 gap-2">
              {(["agent", "admin"] as Role[]).map((role) => (
                <button key={role} type="button" onClick={() => set({ role })} className={`rounded-lg border p-3 text-left text-xs ${u.role === role ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200"}`}>
                  <div className="mb-1 text-sm font-semibold">{ROLE_LABEL[role]}</div>
                  <div className="text-slate-500">{ROLE_ACCESS[role].slice(0, 3).join(" · ")}</div>
                </button>
              ))}
            </div>
          </Field>

          {u.role === "agent" && (
            <>
              <Field label="Nama wilayah"><input className="input" value={u.territory ?? ""} onChange={(e) => set({ territory: e.target.value })} placeholder="mis. Jakarta" /></Field>
              <Field label={`Domisili yang masuk wilayah ini (${u.cities.length})`}>
                <p className="mb-2 text-xs text-slate-500">Pelanggan yang menyebut salah satu domisili ini otomatis diteruskan ke agent ini. Pisahkan dengan koma untuk menambah banyak sekaligus.</p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {u.cities.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm">{c}
                      <button type="button" aria-label={`Hapus ${c}`} className="rounded-full p-0.5 hover:bg-slate-300" onClick={() => set({ cities: u.cities.filter((x) => x !== c) })}><X size={12} /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="mis. Bogor, Depok, Bekasi" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCities(city); } }} />
                  <button type="button" className="btn-ghost shrink-0" onClick={() => addCities(city)}><Plus size={14} /></button>
                </div>
              </Field>
            </>
          )}

          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
            <span><span className="font-medium">Akun aktif</span><span className="block text-xs text-slate-500">Nonaktif = tidak bisa login & tidak menerima lead baru</span></span>
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={u.active} onChange={(e) => set({ active: e.target.checked })} />
          </label>
        </div>
        <div className="border-t border-slate-200 p-4">
          {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
          <div className="flex gap-2"><button className="btn-ghost flex-1" onClick={onClose}>Batal</button><button className="btn-primary flex-1" onClick={save}>Simpan</button></div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-1 text-sm font-medium">{label}</div>{children}</div>;
}
