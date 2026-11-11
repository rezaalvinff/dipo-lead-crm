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
  user: User | null;
  agents: User[];
  leads: LeadV[];
  visibleLeads: LeadV[];
  login: (username: string, password: string) => Result;
  logout: () => void;
  reset: () => void;
  userById: (id?: string) => User | undefined;
  messagesFor: (leadId: string) => Message[];
  sendReply: (leadId: string, text: string, template?: boolean) => Result;
  assignLead: (leadId: string, agentId: string) => void;
  updateLead: (leadId: string, patch: Partial<Pick<Lead, "name" | "city" | "unit">>) => void;
  saveUser: (u: User) => Result;
  deleteUser: (id: string) => void;
  saveKnowledge: (k: KnowledgeItem) => void;
  deleteKnowledge: (id: string) => void;
  updateBot: (patch: Partial<BotSettings>) => void;
  simulateInbound: (phone: string, text: string, source: LeadSource) => string;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(fresh);
  const [ready, setReady] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state, ready]);

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

  const login: Store["login"] = (username, password) => {
    const u = ref.current.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u || u.password !== password) return { ok: false, error: "Username atau password salah" };
    if (!u.active) return { ok: false, error: "Akun ini sedang nonaktif. Hubungi admin." };
    setState((s) => ({ ...s, sessionUserId: u.id, audit: log(s, "Login", u.username, undefined, u.name) }));
    return { ok: true };
  };
  const logout = useCallback(() => setState((s) => ({ ...s, sessionUserId: null })), []);
  const reset = () => setState({ ...fresh(), sessionUserId: ref.current.sessionUserId === "u-admin" ? "u-admin" : null });

  const userById = useCallback((id?: string) => state.users.find((u) => u.id === id), [state.users]);
  const messagesFor = useCallback((leadId: string) => state.messages.filter((m) => m.leadId === leadId).sort((a, b) => a.at - b.at), [state.messages]);

  const sendReply: Store["sendReply"] = (leadId, text, template) => {
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

  const assignLead: Store["assignLead"] = (leadId, agentId) =>
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

  const updateLead: Store["updateLead"] = (leadId, patch) =>
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

  const saveUser: Store["saveUser"] = (u) => {
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

  const deleteUser: Store["deleteUser"] = (id) =>
    setState((s) => {
      const u = s.users.find((x) => x.id === id);
      return {
        ...s,
        users: s.users.filter((x) => x.id !== id),
        leads: s.leads.map((l) => (l.agentId === id ? { ...l, agentId: undefined, inQueue: true, queueReason: `Agent ${u?.name} dihapus` } : l)),
        audit: log(s, "Hapus user", u?.name ?? id, "Leads miliknya dipindah ke Admin Queue"),
      };
    });

  const saveKnowledge: Store["saveKnowledge"] = (k) =>
    setState((s) => {
      const exists = s.knowledge.some((x) => x.id === k.id);
      return { ...s, knowledge: exists ? s.knowledge.map((x) => (x.id === k.id ? k : x)) : [...s.knowledge, k], audit: log(s, exists ? "Ubah knowledge" : "Tambah knowledge", k.title) };
    });
  const deleteKnowledge: Store["deleteKnowledge"] = (id) =>
    setState((s) => ({ ...s, knowledge: s.knowledge.filter((x) => x.id !== id), audit: log(s, "Hapus knowledge", s.knowledge.find((x) => x.id === id)?.title ?? id) }));
  const updateBot: Store["updateBot"] = (patch) => setState((s) => ({ ...s, bot: { ...s.bot, ...patch }, audit: log(s, "Ubah pengaturan chatbot", Object.keys(patch).join(", ")) }));

  const simulateInbound: Store["simulateInbound"] = (phone, text, source) => {
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
    ...state, leads, ready, user, agents, visibleLeads, login, logout, reset, userById, messagesFor,
    sendReply, assignLead, updateLead, saveUser, deleteUser, saveKnowledge, deleteKnowledge, updateBot, simulateInbound,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be inside StoreProvider");
  return s;
}
