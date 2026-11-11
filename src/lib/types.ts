export type Role = "super_admin" | "admin" | "sales";

export type LeadSource = "Meta Ads" | "Google Ads" | "Google Organic" | "WhatsApp Organic" | "Unknown";
export const LEAD_SOURCES: LeadSource[] = ["Meta Ads", "Google Ads", "Google Organic", "WhatsApp Organic", "Unknown"];

export type LeadStatus = "COLD" | "WARM";

export interface User {
  id: string;
  name: string;
  role: Role;
  agentId?: string;
}

export interface Agent {
  id: string;
  name: string;
  territory: string;
  /** Kota/kabupaten yang secara eksplisit ditangani agent (exact match, termasuk alias). */
  cities: string[];
  available: boolean;
  capacity: number;
}

export interface Lead {
  id: string;
  phone: string;
  name?: string;
  city?: string;
  unit?: string;
  source: LeadSource;
  campaign?: string;
  status: LeadStatus;
  agentId?: string;
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
}

export interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  action: string;
  target: string;
  detail?: string;
}
