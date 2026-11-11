"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Agent, AuditEntry, Lead, LeadSource, Message, User } from "./types";
import { seedData, seedUsers } from "./seed";
import { routeLead } from "./routing";
import { extractFields, isQualified, nextAiReply } from "./ai";

const KEY = "dipo-crm-demo-v1";
const WINDOW_MS = 24 * 3600_000;

interface State {
  userId: string | null;
  agents: Agent[];
  leads: Lead[];
  messages: Message[];
  audit: AuditEntry[];
}

const fresh = (): State => ({ userId: null, ...seedData() });

const uid = () => Math.random().toString(36).slice(2, 10);

export const inWindow = (l: Lead, now = Date.now()) => now - l.lastCustomerMsgAt < WINDOW_MS;

interface Store extends State {
  ready: boolean;
  user: User | null;
  users: User[];
  login: (userId: string) => void;
  logout: () => void;
  reset: () => void;
  visibleLeads: Lead[];
  agentById: (id?: string) => Agent | undefined;
  messagesFor: (leadId: string) => Message[];
  sendReply: (leadId: string, text: string, template?: boolean) => { ok: boolean; error?: string };
  assignLead: (leadId: string, agentId: string) => void;
  updateLead: (leadId: string, patch: Partial<Pick<Lead, "name" | "city" | "unit">>) => void;
  updateAgent: (agentId: string, patch: Partial<Agent>, note: string) => void;
  simulateInbound: (phone: string, text: string, source: LeadSource) => string;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(fresh);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

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

  const user = seedUsers.find((u) => u.id === state.userId) ?? null;
  const actor = user?.name ?? "Sistem";

  const log = (s: State, action: string, target: string, detail?: string, who = actor): AuditEntry[] =>
    [{ id: uid(), at: Date.now(), actor: who, action, target, detail }, ...s.audit];

  const login = useCallback((userId: string) => setState((s) => ({ ...s, userId, audit: log(s, "Login", seedUsers.find((u) => u.id === userId)?.name ?? userId, undefined, seedUsers.find((u) => u.id === userId)?.name) })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const logout = useCallback(() => setState((s) => ({ ...s, userId: null })), []);
  const reset = useCallback(() => setState((s) => ({ ...fresh(), userId: s.userId })), []);

  const visibleLeads = useMemo(() => {
    const sorted = [...state.leads].sort((a, b) => b.lastCustomerMsgAt - a.lastCustomerMsgAt);
    if (!user) return [];
    if (user.role === "sales") return sorted.filter((l) => l.agentId === user.agentId);
    return sorted;
  }, [state.leads, user]);

  const agentById = useCallback((id?: string) => state.agents.find((a) => a.id === id), [state.agents]);
  const messagesFor = useCallback((leadId: string) => state.messages.filter((m) => m.leadId === leadId).sort((a, b) => a.at - b.at), [state.messages]);

  const sendReply: Store["sendReply"] = (leadId, text, template) => {
    const lead = stateRef.current.leads.find((l) => l.id === leadId);
    if (!lead) return { ok: false, error: "Lead tidak ditemukan" };
    if (!template && !inWindow(lead)) return { ok: false, error: "Di luar 24-hour customer service window. Gunakan template yang sudah di-approve Meta." };
    if (user?.role === "sales" && lead.agentId !== user.agentId) return { ok: false, error: "Akses ditolak: lead bukan milik Anda." };
    setState((s) => ({
      ...s,
      // Human takeover: AI otomatis berhenti bila sales/admin membalas.
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, aiActive: false } : l)),
      messages: [...s.messages, { id: uid(), leadId, from: "agent", author: actor, text, at: Date.now(), status: "sent", template }],
    }));
    // simulasi status delivery
    setTimeout(() => setState((s) => ({ ...s, messages: s.messages.map((m) => (m.leadId === leadId && m.status === "sent" ? { ...m, status: "delivered" } : m)) })), 1200);
    return { ok: true };
  };

  const assignLead: Store["assignLead"] = (leadId, agentId) =>
    setState((s) => {
      const ag = s.agents.find((a) => a.id === agentId);
      const prev = s.leads.find((l) => l.id === leadId);
      const prevAg = s.agents.find((a) => a.id === prev?.agentId);
      return {
        ...s,
        leads: s.leads.map((l) => (l.id === leadId ? { ...l, agentId, status: "WARM", inQueue: false, queueReason: undefined, aiActive: false, assignedAt: Date.now() } : l)),
        messages: [...s.messages, { id: uid(), leadId, from: "system", text: `${prevAg ? "Reassign" : "Assign"} ke ${ag?.name} oleh ${actor}`, at: Date.now() }],
        audit: log(s, prevAg ? "Reassign sales" : "Assign sales", leadId, `${prevAg ? prevAg.name + " → " : ""}${ag?.name}`),
      };
    });

  const updateLead: Store["updateLead"] = (leadId, patch) =>
    setState((s) => ({
      ...s,
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, ...patch } : l)),
      audit: log(s, "Lengkapi data lead", leadId, Object.entries(patch).map(([k, v]) => `${k}: ${v}`).join(", ")),
    }));

  const updateAgent: Store["updateAgent"] = (agentId, patch, note) =>
    setState((s) => ({
      ...s,
      agents: s.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a)),
      audit: log(s, note, s.agents.find((a) => a.id === agentId)?.name ?? agentId, JSON.stringify(patch)),
    }));

  const simulateInbound: Store["simulateInbound"] = (phone, text, source) => {
    const s0 = stateRef.current;
    const existing = s0.leads.find((l) => l.phone === phone);
    const now = Date.now();
    const leadId = existing?.id ?? `L-${1001 + s0.leads.length}`;
    const isFirst = !existing;

    setState((s) => {
      let lead: Lead = existing
        ? { ...existing, lastCustomerMsgAt: now }
        : { id: leadId, phone, source, campaign: source === "Meta Ads" ? "CTWA - Simulator" : undefined, status: "COLD", inQueue: false, aiActive: true, createdAt: now, lastCustomerMsgAt: now };
      const msgs: Message[] = [{ id: uid(), leadId, from: "customer", text, at: now }];
      let audit = s.audit;

      if (lead.aiActive) {
        const ex = extractFields(text);
        lead = { ...lead, name: lead.name ?? ex.name, city: lead.city ?? ex.city, unit: lead.unit ?? ex.unit };
        msgs.push({ id: uid(), leadId, from: "ai", text: nextAiReply(lead, isFirst), at: now + 1 });
        if (isQualified(lead)) {
          lead.aiActive = false;
          msgs.push({ id: uid(), leadId, from: "system", text: "AI handover — balasan otomatis dihentikan.", at: now + 2 });
          const r = routeLead(lead.city, s.agents, s.leads);
          if (r.kind === "assigned") {
            lead = { ...lead, status: "WARM", agentId: r.agent.id, assignedAt: now };
            msgs.push({ id: uid(), leadId, from: "system", text: `Auto-assign ke ${r.agent.name} (match "${lead.city}")`, at: now + 3 });
            audit = [{ id: uid(), at: now, actor: "Sistem (auto-routing)", action: "Auto assignment", target: leadId, detail: `Ditugaskan ke ${r.agent.name}` }, ...audit];
          } else {
            lead = { ...lead, inQueue: true, queueReason: r.reason };
            msgs.push({ id: uid(), leadId, from: "system", text: `Masuk Admin Queue: ${r.reason}`, at: now + 3 });
            audit = [{ id: uid(), at: now, actor: "Sistem (auto-routing)", action: "Masuk Admin Queue", target: leadId, detail: r.reason }, ...audit];
          }
        }
      }
      const leads = existing ? s.leads.map((l) => (l.id === leadId ? lead : l)) : [...s.leads, lead];
      return { ...s, leads, messages: [...s.messages, ...msgs], audit };
    });
    return leadId;
  };

  const value: Store = {
    ...state, ready, user, users: seedUsers, login, logout, reset, visibleLeads, agentById, messagesFor,
    sendReply, assignLead, updateLead, updateAgent, simulateInbound,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be inside StoreProvider");
  return s;
}
