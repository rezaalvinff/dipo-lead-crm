import { NextResponse } from "next/server";
import { ensureDb, isLive } from "@/lib/server/db";
import { verifySignature } from "@/lib/server/whatsapp";
import { handleInbound, updateMessageStatus } from "@/lib/server/repo";
import type { LeadSource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Verifikasi webhook oleh Meta (saat mendaftarkan Callback URL). */
export function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

interface WaMessage {
  id: string; from: string; type: string;
  text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; ctwa_clid?: string };
}

function textOf(m: WaMessage) {
  if (m.text) return m.text.body;
  if (m.button) return m.button.text;
  if (m.interactive) return m.interactive.button_reply?.title ?? m.interactive.list_reply?.title ?? "[interaktif]";
  return `[${m.type}]`;
}

function sourceOf(m: WaMessage): { source: LeadSource; campaign?: string; adHeadline?: string; sourceUrl?: string; adId?: string; ctwaClid?: string } {
  const r = m.referral;
  if (r?.ctwa_clid || r?.source_type === "ad") return { source: "Meta Ads", campaign: r.headline, adHeadline: r.headline, sourceUrl: r.source_url, adId: r.source_id, ctwaClid: r.ctwa_clid };
  // Link wa.me dari Google memakai teks prefilled/UTM; tanpa bukti tetap "WhatsApp Organic".
  const t = textOf(m).toLowerCase();
  if (/\[gads\]|utm_source=google&utm_medium=cpc/.test(t)) return { source: "Google Ads" };
  if (/\[google\]|utm_source=google/.test(t)) return { source: "Google Organic" };
  return { source: "WhatsApp Organic" };
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });
  if (!isLive()) return new Response("ok");
  await ensureDb();
  const body = JSON.parse(raw);
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      for (const s of v.statuses ?? []) await updateMessageStatus(s.id, s.status).catch(console.error);
      for (const m of (v.messages ?? []) as WaMessage[]) {
        try {
          await handleInbound({ phone: m.from, text: textOf(m), waMessageId: m.id, profileName: v.contacts?.[0]?.profile?.name, ...sourceOf(m) });
        } catch (e) {
          console.error("Gagal memproses pesan", m.id, e);
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
