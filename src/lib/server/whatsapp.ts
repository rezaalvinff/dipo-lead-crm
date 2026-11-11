import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const GRAPH = () => `https://graph.facebook.com/${process.env.GRAPH_API_VERSION || "v23.0"}`;

export const waConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/** Validasi header X-Hub-Signature-256 dari Meta. */
export function verifySignature(raw: string, header: string | null) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(raw).digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

async function graphPost(path: string, body: unknown) {
  const res = await fetch(`${GRAPH()}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${json?.error?.message ?? "unknown error"}`);
  return json;
}

/** Kirim pesan teks. Mengembalikan WhatsApp message id. */
export async function sendText(to: string, body: string): Promise<string> {
  const r = await graphPost(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp", recipient_type: "individual", to: to.replace(/\D/g, ""), type: "text", text: { body, preview_url: false },
  });
  return r.messages?.[0]?.id;
}

/** Kirim template yang sudah di-approve (untuk di luar 24-hour window). */
export async function sendTemplate(to: string, name: string, language: string, params: string[]): Promise<string> {
  const r = await graphPost(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "template",
    template: { name, language: { code: language }, components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [] },
  });
  return r.messages?.[0]?.id;
}

export async function markRead(messageId: string) {
  await graphPost(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { messaging_product: "whatsapp", status: "read", message_id: messageId }).catch(() => {});
}

export interface WaTemplate { name: string; language: string; body: string; params: number }

export async function listTemplates(): Promise<WaTemplate[]> {
  const waba = process.env.WHATSAPP_WABA_ID;
  if (!waba || !process.env.WHATSAPP_TOKEN) return [];
  const res = await fetch(`${GRAPH()}/${waba}/message_templates?status=APPROVED&limit=50&fields=name,language,components`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${json?.error?.message ?? ""}`);
  return (json.data ?? []).map((t: { name: string; language: string; components: { type: string; text?: string }[] }) => {
    const body = t.components.find((c) => c.type === "BODY")?.text ?? "";
    return { name: t.name, language: t.language, body, params: (body.match(/\{\{\d+\}\}/g) ?? []).length };
  });
}

export async function phoneInfo() {
  if (!waConfigured()) return null;
  const res = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
  const json = await res.json();
  if (!res.ok) return { error: json?.error?.message ?? `HTTP ${res.status}` };
  return { number: json.display_phone_number as string, name: json.verified_name as string, quality: json.quality_rating as string };
}
