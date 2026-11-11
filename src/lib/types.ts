export type Role = "admin" | "agent";

export type LeadSource = "Meta Ads" | "Google Ads" | "Google Organic" | "WhatsApp Organic" | "Unknown";
export const LEAD_SOURCES: LeadSource[] = ["Meta Ads", "Google Ads", "Google Organic", "WhatsApp Organic", "Unknown"];

/** COLD = data belum lengkap. WARM = nama, domisili, dan unit sudah lengkap. */
export type LeadStatus = "COLD" | "WARM";

export interface User {
  id: string;
  name: string;
  username: string;
  /** Demo saja — di produksi password di-hash di backend. */
  password: string;
  role: Role;
  active: boolean;
  /** Khusus agent: nama wilayah, mis. "Jakarta". */
  territory?: string;
  /** Khusus agent: daftar domisili (kota/kabupaten) yang auto di-route ke agent ini. */
  cities: string[];
}

export interface Lead {
  id: string;
  phone: string;
  name?: string;
  city?: string;
  unit?: string;
  source: LeadSource;
  campaign?: string;
  /** Ad id dari referral Click-to-WhatsApp (untuk menghubungkan ke hasil iklan). */
  adId?: string;
  /** Click id CTWA, dipakai untuk Conversions API. */
  ctwaClid?: string;
  /** Nama profil WhatsApp (contacts[0].profile.name). */
  profileName?: string;
  /** Headline & URL iklan dari referral CTWA. */
  adHeadline?: string;
  sourceUrl?: string;
  /** Percakapan sudah ditandai selesai oleh CS. */
  resolved?: boolean;
  /** Demo: jumlah pesan belum dibaca & indikator AI mengetik. */
  unread?: number;
  typing?: boolean;
  /** Status pengiriman event ke Meta CAPI. */
  capiStatus?: "sent" | "failed";
  /** User id agent yang menangani. */
  agentId?: string;
  /** Lead WARM yang domisilinya tidak cocok dengan wilayah agent mana pun. */
  inQueue: boolean;
  queueReason?: string;
  /** true selama AI masih melakukan kualifikasi. false setelah handover. */
  aiActive: boolean;
  createdAt: number;
  lastCustomerMsgAt: number;
  assignedAt?: number;
}

export type Sender = "customer" | "ai" | "agent" | "system";

export interface Message {
  id: string;
  leadId: string;
  from: Sender;
  text: string;
  at: number;
  author?: string;
  status?: "sent" | "delivered" | "read";
  template?: boolean;
  /** Judul knowledge yang dipakai AI untuk menjawab (jika ada). */
  knowledge?: string;
  /** Chunk konteks hasil retrieval (RAG) yang dipakai AI. */
  sources?: { title: string; index: number; score: number }[];
}

export interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  action: string;
  target: string;
  detail?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  /** Kata kunci tambahan (opsional) untuk membantu pencarian. */
  keywords: string[];
  /** Isi dokumen / FAQ / SOP. Dipotong menjadi chunk untuk RAG. */
  answer: string;
  active: boolean;
  /** Nama file asal jika di-upload. */
  fileName?: string;
}

export interface BotSettings {
  persona: string;
  greeting: string;
  askName: string;
  askCity: string;
  askUnit: string;
  /** Placeholder: {nama} {domisili} {unit} */
  handover: string;
  units: string[];
}
