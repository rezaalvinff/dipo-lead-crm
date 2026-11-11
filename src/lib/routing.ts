import type { User } from "./types";

export const normalizeCity = (s: string) =>
  s.toLowerCase().replace(/^(kota|kab\.?|kabupaten)\s+/, "").replace(/\s+/g, " ").trim();

export type RouteResult = { kind: "assigned"; agent: User } | { kind: "queue"; reason: string };

/**
 * Domisili pelanggan dicocokkan persis (exact match) dengan daftar domisili tiap agent.
 * Tidak cocok / agent nonaktif -> Admin Queue untuk di-assign manual.
 */
export function routeLead(city: string | undefined, users: User[]): RouteResult {
  if (!city) return { kind: "queue", reason: "Domisili belum diketahui" };
  const c = normalizeCity(city);
  const agent = users.find((u) => u.role === "agent" && u.cities.some((x) => normalizeCity(x) === c));
  if (!agent) return { kind: "queue", reason: `Domisili "${city}" belum terdaftar di wilayah agent mana pun` };
  if (!agent.active) return { kind: "queue", reason: `${agent.name} sedang nonaktif` };
  return { kind: "assigned", agent };
}
