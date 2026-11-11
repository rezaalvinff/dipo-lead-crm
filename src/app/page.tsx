"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck, UserCog, User as UserIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/permissions";

export default function LoginPage() {
  const { users, login, agents } = useStore();
  const router = useRouter();
  const go = (id: string) => { login(id); router.push("/dashboard"); };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-900 via-slate-800 to-brand-700 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-lg font-black text-white">D</div>
          <div>
            <h1 className="text-lg font-bold">DIPO Lead CRM</h1>
            <p className="text-sm text-slate-500">AI WhatsApp Lead Management</p>
          </div>
        </div>
        <div className="mb-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Prototype frontend dengan data dummy. Pilih role untuk masuk — tidak perlu password.
        </div>
        <div className="space-y-2">
          {users.map((u) => {
            const Icon = u.role === "super_admin" ? ShieldCheck : u.role === "admin" ? UserCog : UserIcon;
            const ag = agents.find((a) => a.id === u.agentId);
            return (
              <button key={u.id} onClick={() => go(u.id)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-500 hover:bg-brand-50">
                <Icon className="text-brand-600" size={20} />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{u.name}</div>
                  <div className="text-xs text-slate-500">{ROLE_LABEL[u.role]}{ag ? ` · Wilayah ${ag.territory}` : ""}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
