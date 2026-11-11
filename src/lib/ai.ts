import type { BotSettings, KnowledgeItem, Lead, LeadStatus } from "./types";

/** Kota umum yang dikenali AI selain domisili yang sudah didaftarkan di agent. */
export const KNOWN_CITIES = [
  "Medan", "Binjai", "Deli Serdang", "Jakarta", "Jakarta Selatan", "Jakarta Barat", "Jakarta Timur",
  "Jakarta Utara", "Jakarta Pusat", "Bekasi", "Depok", "Tangerang", "Tangerang Selatan", "Bogor", "Karawang",
  "Pekanbaru", "Kampar", "Dumai", "Surabaya", "Sidoarjo", "Gresik", "Malang", "Padang", "Bukittinggi",
  "Pariaman", "Bandung", "Semarang", "Yogyakarta", "Makassar", "Palembang", "Batam", "Denpasar", "Balikpapan",
];

export const statusOf = (l: Pick<Lead, "name" | "city" | "unit">): LeadStatus => (l.name && l.city && l.unit ? "WARM" : "COLD");

export interface Extracted { name?: string; city?: string; unit?: string }

/** Simulasi ekstraksi AI (mock rule-based). Di produksi diganti LLM yang mengembalikan field terstruktur. */
export function extractFields(text: string, cities: string[], units: string[], expecting?: keyof Extracted): Extracted {
  const out: Extracted = {};
  const t = text.trim();
  const nameMatch = t.match(/(?:[Nn]ama\s+(?:[Ss]aya|[Aa]ku|[Ss]y)\s*(?:adalah)?|[Ss]aya|[Aa]ku|[Ss]y|[Dd]engan)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (nameMatch) out.name = nameMatch[1];
  const lower = t.toLowerCase();
  const all = Array.from(new Set([...KNOWN_CITIES, ...cities]));
  const city = all.sort((a, b) => b.length - a.length).find((c) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(lower));
  if (city) out.city = city;
  else {
    // Kota yang tidak dikenal tetap ditangkap dari pola "dari X" / "di X", lalu di-route (biasanya ke Admin Queue).
    const m = t.match(/\b(?:dari|di|domisili|tinggal di|daerah)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
    if (m && !/^(Mitsubishi|DIPO)\b/.test(m[1]) && !units.some((u) => m[1].toLowerCase().includes(u.toLowerCase()))) out.city = m[1];
  }
  const unit = [...units].sort((a, b) => b.length - a.length).find((u) => lower.includes(u.toLowerCase()));
  if (unit) out.unit = unit;
  else if (/belum tahu|blm tau|belum tau|bingung/.test(lower)) out.unit = "Belum tahu";

  // Jawaban singkat atas pertanyaan terakhir AI, mis. "Bambang" atau "di Cikarang".
  const short = t.replace(/[.!?]+$/, "").replace(/^(di|dari|daerah|domisili|tinggal di)\s+/i, "").trim();
  const isShort = short && short.split(/\s+/).length <= 3 && !/\d/.test(short);
  const cap = (x: string) => x.replace(/\b\w/g, (c) => c.toUpperCase());
  if (expecting === "name" && !out.name && isShort && !/^(halo|hai|ok|iya|ya)\b/i.test(short)) out.name = cap(short);
  if (expecting === "city" && !out.city && isShort) out.city = cap(short);
  return out;
}

export function matchKnowledge(text: string, items: KnowledgeItem[]): KnowledgeItem | undefined {
  const lower = text.toLowerCase();
  return items.find((k) => k.active && k.keywords.some((kw) => kw && lower.includes(kw.toLowerCase())));
}

export const fill = (tpl: string, l: Partial<Lead>) =>
  tpl.replace(/\{nama\}/g, l.name ?? "").replace(/\{domisili\}/g, l.city ?? "").replace(/\{unit\}/g, l.unit ?? "").replace(/\s+([!.,])/g, "$1");

export const expectingField = (l: Partial<Lead>): keyof Extracted | undefined =>
  !l.name ? "name" : !l.city ? "city" : !l.unit ? "unit" : undefined;

/** Pertanyaan berikutnya untuk field yang belum lengkap, atau pesan handover jika sudah lengkap. */
export function nextQuestion(lead: Lead, s: BotSettings): string {
  if (!lead.name) return fill(s.askName, lead);
  if (!lead.city) return fill(s.askCity, lead);
  if (!lead.unit) return fill(s.askUnit, lead);
  return fill(s.handover, lead);
}

import { answerFrom, looksLikeQuestion, retrieve } from "./rag";
import type { Message } from "./types";

export interface BotTurn { name?: string; city?: string; unit?: string; reply: string; knowledge?: string; sources?: Message["sources"] }

/**
 * Satu giliran bot (mock LLM): RAG retrieval untuk menjawab pertanyaan,
 * ekstraksi nama/domisili/unit, lalu pertanyaan kualifikasi berikutnya.
 */
export function botTurn(p: { lead: Lead; text: string; bot: BotSettings; knowledge: KnowledgeItem[]; cities: string[]; isFirst: boolean }): BotTurn {
  const hits = looksLikeQuestion(p.text) ? retrieve(p.text, p.knowledge) : [];
  const answer = answerFrom(hits, p.text);
  const expecting = !p.isFirst && !answer && !p.text.includes("?") ? expectingField(p.lead) : undefined;
  const ex = extractFields(p.text, p.cities, p.bot.units, expecting);
  // Pertanyaan tentang unit (mis. "bedanya Xpander sama Xpander Cross?") belum tentu berarti minat.
  if (answer && p.text.includes("?")) delete ex.unit;
  const merged = { ...p.lead, name: p.lead.name ?? ex.name, city: p.lead.city ?? ex.city, unit: p.lead.unit ?? ex.unit };
  const reply = [p.isFirst ? p.bot.greeting : "", answer ?? "", statusOf(merged) === "WARM" ? "" : nextQuestion(merged, p.bot)].filter(Boolean).join("\n\n");
  return {
    ...ex, reply,
    knowledge: answer ? hits[0].title : undefined,
    sources: answer ? hits.map((h) => ({ title: h.title, index: h.index, score: Math.round(h.score * 100) / 100 })) : undefined,
  };
}
