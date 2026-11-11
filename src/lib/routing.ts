import type { Agent, Lead } from "./types";

export const normalizeCity = (s: string) =>
  s.toLowerCase().replace(/^(kota|kab\.?|kabupaten)\s+/, "").replace(/\s+/g, " ").trim();

export type RouteResult =
  | { kind: "assigned"; agent: Agent }
  | { kind: "queue"; reason: string };

/**
 * Aturan routing (sheet "Routing Wilayah"):
 * 1. Exact match kota/kabupaten atau alias yang diinput admin.
 * 2. Tidak menebak kota terdekat.
 * 3. Tidak ada mapping -> Admin Queue (COLD).
 * 4. Agent tidak tersedia / kapasitas penuh -> fallback default Admin Queue.
 * 5. WARM hanya setelah assignment resmi.
 */
export function routeLead(city: string | undefined, agents: Agent[], leads: Lead[]): RouteResult {
  if (!city) return { kind: "queue", reason: "Domisili belum diketahui" };
  const c = normalizeCity(city);
  const agent = agents.find((a) => a.cities.some((x) => normalizeCity(x) === c));
  if (!agent) return { kind: "queue", reason: `Domisili "${city}" tidak ada di mapping wilayah` };
  if (!agent.available) return { kind: "queue", reason: `${agent.name} sedang tidak tersedia` };
  const load = activeLoad(agent.id, leads);
  if (load >= agent.capacity) return { kind: "queue", reason: `Kapasitas ${agent.name} penuh (${load}/${agent.capacity})` };
  return { kind: "assigned", agent };
}

export const activeLoad = (agentId: string, leads: Lead[]) =>
  leads.filter((l) => l.agentId === agentId && l.status === "WARM").length;
