import type { Lead } from "./types";

export const UNIT_MODELS = [
  "Xpander Cross",
  "Xpander",
  "Pajero Sport",
  "Xforce",
  "Destinator",
  "Triton",
  "L300",
  "Outlander PHEV",
  "L100 EV",
];

/** Daftar kota yang dikenali AI untuk ekstraksi (bukan untuk routing). */
export const KNOWN_CITIES = [
  "Medan", "Binjai", "Deli Serdang", "Jakarta", "Jakarta Selatan", "Jakarta Barat", "Jakarta Timur",
  "Jakarta Utara", "Jakarta Pusat", "Bekasi", "Depok", "Tangerang", "Bogor", "Pekanbaru", "Kampar",
  "Dumai", "Surabaya", "Sidoarjo", "Gresik", "Malang", "Padang", "Bukittinggi", "Pariaman",
  "Bandung", "Semarang", "Yogyakarta", "Makassar", "Palembang", "Batam", "Denpasar", "Balikpapan",
];

export interface Extracted { name?: string; city?: string; unit?: string }

/**
 * Simulasi AI qualification (mock rule-based). Di produksi diganti LLM
 * yang mengembalikan field terstruktur.
 */
export function extractFields(text: string): Extracted {
  const out: Extracted = {};
  const t = text.trim();

  const nameMatch = t.match(/(?:nama\s+(?:saya|aku|sy)\s*(?:adalah)?|saya|aku|sy)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (nameMatch) out.name = nameMatch[1];

  const lower = t.toLowerCase();
  const city = [...KNOWN_CITIES].sort((a, b) => b.length - a.length).find((c) => lower.includes(c.toLowerCase()));
  if (city) out.city = city;

  const unit = UNIT_MODELS.find((u) => lower.includes(u.toLowerCase()));
  if (unit) out.unit = unit;
  else if (/belum tahu|blm tau|belum tau|bingung/.test(lower)) out.unit = "Belum tahu";

  return out;
}

export function nextAiReply(lead: Lead, isFirst: boolean): string {
  const missing: string[] = [];
  if (!lead.name) missing.push("nama");
  if (!lead.city) missing.push("kota/kabupaten domisili");
  if (!lead.unit) missing.push("unit Mitsubishi yang diminati");

  const greet = isFirst
    ? "Halo, terima kasih sudah menghubungi Mitsubishi DIPO! Saya asisten virtual yang akan membantu meneruskan kebutuhan Anda ke tim sales. "
    : "";

  if (missing.length === 0) return HANDOVER_MESSAGE(lead);
  if (!lead.name) return `${greet}Boleh saya tahu dengan Bapak/Ibu siapa?`;
  if (!lead.city) return `${greet}Terima kasih, ${lead.name}. Saat ini berdomisili di kota/kabupaten mana?`;
  return `${greet}Baik. Unit Mitsubishi apa yang sedang diminati? (contoh: Xpander, Pajero Sport, Xforce, Triton). Kalau belum tahu juga tidak apa-apa.`;
}

export const HANDOVER_MESSAGE = (lead: Lead) =>
  `Terima kasih ${lead.name ?? ""}! Data Anda sudah kami terima (domisili: ${lead.city}, unit: ${lead.unit}). Tim sales kami akan segera melanjutkan percakapan ini. 🙏`;

export const isQualified = (l: Lead) => Boolean(l.name && l.city && l.unit);
