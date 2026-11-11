"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AuditEntry, BotSettings, KnowledgeItem, Lead, LeadSource, LeadStatus, Message, User } from "./types";
import { seedData } from "./seed";
import { normalizeCity, routeLead } from "./routing";
import { expectingField, extractFields, matchKnowledge, nextQuestion, statusOf } from "./ai";

const KEY = "dipo-crm-demo-v2";
const WINDOW_MS = 24 * 3600_000;

interface State {
  sessionUserId: string | null;
  users: User[];
  bot: BotSettings;
  knowledge: KnowledgeItem[];
  leads: Lead[];
  messages: Message[];
  audit: AuditEntry[];
}

export type LeadV = Lead & { status: LeadStatus };
type Result = { ok: true } | { ok: false; error: string };

const fresh = (): State => ({ sessionUserId: null, ...seedData() });
const uid = () => Math.random().toString(36).slice(2, 10);

export const inWindow = (l: Lead, now = Date.now()) => now - l.lastCustomerMsgAt < WINDOW_MS;

interface Store extends Omit<State, "leads"> {
  ready: boolean;
  /** true = tersambung ke backend + database (produksi). false = demo localStorage. */
  live: boolean;
  refresh: () => Promise<void>;
  user: User | null;
  agents: User[];
  leads: LeadV[];
  visibleLeads: LeadV[];
  login: (username: string, password: string) => Promise<Result>;
  logout: () => void;
  reset: () => void;
  userById: (id?: string) => User | undefined;
  messagesFor: (leadId: string) => Message[];
  sendReply: (leadId: string, text: string, template?: boolean) => Promise<Result>;
  sendTemplate: (leadId: string, t: { name: string; language: string; body: string }, params: string[]) => Promise<Result>;
  assignLead: (leadId: string, agentId: string) => void;
  updateLead: (leadId: string, patch: Partial<Pick<Lead, "name" | "city" | "unit">>) => void;
  saveUser: (u: User) => Promise<Result>;
  deleteUser: (id: string) => void;
  saveKnowledge: (k: KnowledgeItem) => void;
  deleteKnowledge: (id: string) => void;
  updateBot: (patch: Partial<BotSettings>) => void;
  simulateInbound: (phone: string, text: string, source: LeadSource) => Promise<string>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(fresh);
  const [ready, setReady] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) { setState((s) => ({ ...s, sessionUserId: null })); return; }
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    (async () => {
      const health = await fetch("/api/health").then((r) => r.json()).catch(() => ({ live: false }));
      if (health.live) {
        setLive(true);
        setState((s) => ({ ...s, sessionUserId: null, leads: [], messages: [], audit: [], users: [], knowledge: [] }));
        await refresh().catch(() => {});
      } else {
        try {
          const raw = localStorage.getItem(KEY);
          if (raw) setState(JSON.parse(raw));
        } catch {}
      }
      setReady(true);
    })();
  }, [refresh]);

  useEffect(() => {
    if (!ready || live) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state, ready, live]);

  // Live: polling data baru (pesan masuk) setiap 4 detik.
  useEffect(() => {
    if (!live || !state.sessionUserId) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") refresh().catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, [live, state.sessionUserId, refresh]);

  const rpc = async (action: string, args: Record<string, unknown>): Promise<Result & { data?: Record<string, unknown> }> => {
    const res = await fetch("/api/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, args }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false as const, error: String(data.error ?? `Error ${res.status}`) };
    await refresh();
    return { ok: true as const, data };
  };

  const user = state.users.find((u) => u.id === state.sessionUserId) ?? null;
  const actor = user?.name ?? "Sistem";
  const log = (s: State, action: string, target: string, detail?: string, who = actor): AuditEntry[] =>
    [{ id: uid(), at: Date.now(), actor: who, action, target, detail }, ...s.audit];

  const leads = useMemo<LeadV[]>(
    () => state.leads.map((l) => ({ ...l, status: statusOf(l) })).sort((a, b) => b.lastCustomerMsgAt - a.lastCustomerMsgAt),
    [state.leads],
  );
  const visibleLeads = useMemo(() => (user?.role === "agent" ? leads.filter((l) => l.agentId === user.id) : user ? leads : []), [leads, user]);
  const agents = useMemo(() => state.users.filter((u) => u.role === "agent"), [state.users]);

  const demo_login = (username: string, password: string): Result => {
    const u = ref.current.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u || u.password !== password) return { ok: false, error: "Username atau password salah" };
    if (!u.active) return { ok: false, error: "Akun ini sedang nonaktif. Hubungi admin." };
    setState((s) => ({ ...s, sessionUserId: u.id, audit: log(s, "Login", u.username, undefined, u.name) }));
    return { ok: true };
  };
  const demo_logout = useCallback(() => setState((s) => ({ ...s, sessionUserId: null })), []);
  const demo_reset = () => setState({ ...fresh(), sessionUserId: ref.current.sessionUserId === "u-admin" ? "u-admin" : null });

  const userById = useCallback((id?: string) => state.users.find((u) => u.id === id), [state.users]);
  const messagesFor = useCallback((leadId: string) => state.messages.filter((m) => m.leadId === leadId).sort((a, b) => a.at - b.at), [state.messages]);

  const demo_sendReply = (leadId: string, text: string, template?: boolean): Result => {
    const lead = ref.current.leads.find((l) => l.id === leadId);
    if (!lead) return { ok: false, error: "Lead tidak ditemukan" };
    if (user?.role === "agent" && lead.agentId !== user.id) return { ok: false, error: "Akses ditolak: lead bukan milik Anda." };
    if (!template && !inWindow(lead)) return { ok: false, error: "Di luar 24-hour customer service window. Gunakan template yang sudah di-approve Meta." };
    setState((s) => ({
      ...s,
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, aiActive: false } : l)), // human takeover
      messages: [...s.messages, { id: uid(), leadId, from: "agent", author: actor, text, at: Date.now(), status: "sent", template }],
    }));
    setTimeout(() => setState((s) => ({ ...s, messages: s.messages.map((m) => (m.leadId === leadId && m.status === "sent" ? { ...m, status: "delivered" } : m)) })), 1200);
    return { ok: true };
  };

  const demo_assignLead = (leadId: string, agentId: string) =>
    setState((s) => {
      const ag = s.users.find((a) => a.id === agentId);
      const prev = s.users.find((a) => a.id === s.leads.find((l) => l.id === leadId)?.agentId);
      return {
        ...s,
        leads: s.leads.map((l) => (l.id === leadId ? { ...l, agentId, inQueue: false, queueReason: undefined, aiActive: false, assignedAt: Date.now() } : l)),
        messages: [...s.messages, { id: uid(), leadId, from: "system", text: `${prev ? "Reassign" : "Assign"} ke ${ag?.name} oleh ${actor}`, at: Date.now() }],
        audit: log(s, prev ? "Reassign agent" : "Assign agent", leadId, `${prev ? prev.name + " → " : ""}${ag?.name}`),
      };
    });

  const demo_updateLead = (leadId: string, patch: Partial<Pick<Lead, "name" | "city" | "unit">>) =>
    setState((s) => {
      let lead = { ...s.leads.find((l) => l.id === leadId)!, ...patch };
      const msgs: Message[] = [];
      let audit = log(s, "Ubah data lead", leadId, Object.entries(patch).map(([k, v]) => `${k}: ${v}`).join(", "));
      if (!lead.agentId && statusOf(lead) === "WARM") {
        const r = routeLead(lead.city, s.users);
        if (r.kind === "assigned") {
          lead = { ...lead, agentId: r.agent.id, inQueue: false, queueReason: undefined, assignedAt: Date.now() };
          msgs.push({ id: uid(), leadId, from: "system", text: `Auto-assign ke ${r.agent.name} (${r.agent.territory})`, at: Date.now() });
          audit = [{ id: uid(), at: Date.now(), actor: "Sistem", action: "Auto assignment", target: leadId, detail: r.agent.name }, ...audit];
        } else lead = { ...lead, inQueue: true, queueReason: r.reason };
      }
      return { ...s, leads: s.leads.map((l) => (l.id === leadId ? lead : l)), messages: [...s.messages, ...msgs], audit };
    });

  const demo_saveUser = (u: User): Result => {
    const s = ref.current;
    if (!u.name.trim() || !u.username.trim()) return { ok: false, error: "Nama dan username wajib diisi" };
    if (u.password.length < 6) return { ok: false, error: "Password minimal 6 karakter" };
    if (s.users.some((x) => x.id !== u.id && x.username.toLowerCase() === u.username.toLowerCase())) return { ok: false, error: `Username "${u.username}" sudah dipakai` };
    if (u.role === "agent") {
      for (const c of u.cities) {
        const owner = s.users.find((x) => x.id !== u.id && x.role === "agent" && x.cities.some((y) => normalizeCity(y) === normalizeCity(c)));
        if (owner) return { ok: false, error: `Domisili "${c}" sudah masuk wilayah ${owner.name} (${owner.territory})` };
      }
    }
    if (u.id === s.sessionUserId && (u.role !== "admin" || !u.active)) return { ok: false, error: "Tidak bisa menurunkan role / menonaktifkan akun yang sedang dipakai" };
    const clean: User = { ...u, cities: u.role === "agent" ? u.cities : [], territory: u.role === "agent" ? u.territory : undefined };
    const exists = s.users.some((x) => x.id === u.id);
    setState((st) => ({
      ...st,
      users: exists ? st.users.map((x) => (x.id === u.id ? clean : x)) : [...st.users, clean],
      audit: log(st, exists ? "Ubah user" : "Tambah user", `${u.name} (${u.username})`, u.role === "agent" ? `Agent ${u.territory ?? ""}: ${u.cities.join(", ")}` : "Admin"),
    }));
    return { ok: true };
  };

  const demo_deleteUser = (id: string) =>
    setState((s) => {
      const u = s.users.find((x) => x.id === id);
      return {
        ...s,
        users: s.users.filter((x) => x.id !== id),
        leads: s.leads.map((l) => (l.agentId === id ? { ...l, agentId: undefined, inQueue: true, queueReason: `Agent ${u?.name} dihapus` } : l)),
        audit: log(s, "Hapus user", u?.name ?? id, "Leads miliknya dipindah ke Admin Queue"),
      };
    });

  const demo_saveKnowledge = (k: KnowledgeItem) =>
    setState((s) => {
      const exists = s.knowledge.some((x) => x.id === k.id);
      return { ...s, knowledge: exists ? s.knowledge.map((x) => (x.id === k.id ? k : x)) : [...s.knowledge, k], audit: log(s, exists ? "Ubah knowledge" : "Tambah knowledge", k.title) };
    });
  const demo_deleteKnowledge = (id: string) =>
    setState((s) => ({ ...s, knowledge: s.knowledge.filter((x) => x.id !== id), audit: log(s, "Hapus knowledge", s.knowledge.find((x) => x.id === id)?.title ?? id) }));
  const demo_updateBot = (patch: Partial<BotSettings>) => setState((s) => ({ ...s, bot: { ...s.bot, ...patch }, audit: log(s, "Ubah pengaturan chatbot", Object.keys(patch).join(", ")) }));

  const demo_simulateInbound = (phone: string, text: string, source: LeadSource): string => {
    const s0 = ref.current;
    const existing = s0.leads.find((l) => l.phone === phone);
    const now = Date.now();
    const leadId = existing?.id ?? `L-${1001 + s0.leads.length}`;

    setState((s) => {
      let lead: Lead = existing
        ? { ...existing, lastCustomerMsgAt: now }
        : { id: leadId, phone, source, campaign: source === "Meta Ads" ? "CTWA - Simulator" : undefined, inQueue: false, aiActive: true, createdAt: now, lastCustomerMsgAt: now };
      const msgs: Message[] = [{ id: uid(), leadId, from: "customer", text, at: now }];
      let audit = s.audit;

      if (lead.aiActive) {
        const allCities = s.users.flatMap((u) => u.cities);
        const kb = matchKnowledge(text, s.knowledge);
        // Jawaban singkat hanya dianggap jawaban pertanyaan terakhir jika bukan pertanyaan pelanggan.
        const expecting = existing && !kb && !text.includes("?") ? expectingField(lead) : undefined;
        const ex = extractFields(text, allCities, s.bot.units, expecting);
        lead = { ...lead, name: lead.name ?? ex.name, city: lead.city ?? ex.city, unit: lead.unit ?? ex.unit };
        const parts = [!existing ? s.bot.greeting : "", kb?.answer ?? "", nextQuestion(lead, s.bot)].filter(Boolean);
        msgs.push({ id: uid(), leadId, from: "ai", text: parts.join("\n\n"), at: now + 1, knowledge: kb?.title });

        if (statusOf(lead) === "WARM") {
          lead.aiActive = false;
          msgs.push({ id: uid(), leadId, from: "system", text: "Data lengkap → WARM. AI handover, balasan otomatis dihentikan.", at: now + 2 });
          const r = routeLead(lead.city, s.users);
          if (r.kind === "assigned") {
            lead = { ...lead, agentId: r.agent.id, assignedAt: now };
            msgs.push({ id: uid(), leadId, from: "system", text: `Auto-assign ke ${r.agent.name} (${r.agent.territory}) — domisili "${lead.city}"`, at: now + 3 });
            audit = [{ id: uid(), at: now, actor: "Sistem", action: "Auto assignment", target: leadId, detail: `${r.agent.name} (${r.agent.territory})` }, ...audit];
          } else {
            lead = { ...lead, inQueue: true, queueReason: r.reason };
            msgs.push({ id: uid(), leadId, from: "system", text: `Masuk Admin Queue: ${r.reason}`, at: now + 3 });
            audit = [{ id: uid(), at: now, actor: "Sistem", action: "Masuk Admin Queue", target: leadId, detail: r.reason }, ...audit];
          }
        }
      }
      const leads = existing ? s.leads.map((l) => (l.id === leadId ? lead : l)) : [...s.leads, lead];
      return { ...s, leads, messages: [...s.messages, ...msgs], audit };
    });
    return leadId;
  };

  const value: Store = {
    ...state, leads, ready, live, refresh, user, agents, visibleLeads, userById, messagesFor,
    login: async (u, p) => {
      if (!live) return demo_login(u, p);
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u, password: p }) });
      if (!res.ok) return { ok: false as const, error: String((await res.json().catch(() => ({}))).error ?? "Login gagal") };
      await refresh();
      return { ok: true as const };
    },
    logout: () => { if (live) fetch("/api/auth/logout", { method: "POST" }); demo_logout(); },
    reset: () => { if (!live) demo_reset(); },
    sendReply: async (leadId, text, template) => (live ? rpc("reply", { leadId, text }) : demo_sendReply(leadId, text, template)),
    sendTemplate: async (leadId, t, params) => (live ? rpc("replyTemplate", { leadId, ...t, params }) : demo_sendReply(leadId, params.reduce((b, p, i) => b.replace(`{{${i + 1}}}`, p), t.body), true)),
    assignLead: (leadId, agentId) => { if (live) void rpc("assignLead", { leadId, agentId }); else demo_assignLead(leadId, agentId); },
    updateLead: (leadId, patch) => { if (live) void rpc("updateLead", { leadId, patch }); else demo_updateLead(leadId, patch); },
    saveUser: async (u) => (live ? rpc("saveUser", { user: u }) : demo_saveUser(u)),
    deleteUser: (id) => { if (live) void rpc("deleteUser", { id }); else demo_deleteUser(id); },
    saveKnowledge: (item) => { if (live) void rpc("saveKnowledge", { item }); else demo_saveKnowledge(item); },
    deleteKnowledge: (id) => { if (live) void rpc("deleteKnowledge", { id }); else demo_deleteKnowledge(id); },
    updateBot: (patch) => { if (live) void rpc("updateBot", { patch }); else demo_updateBot(patch); },
    simulateInbound: async (phone, text, source) => {
      if (!live) return demo_simulateInbound(phone, text, source);
      const r = await rpc("simulate", { phone, text, source });
      return (r.data?.leadId as string) ?? "";
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be inside StoreProvider");
  return s;
}
