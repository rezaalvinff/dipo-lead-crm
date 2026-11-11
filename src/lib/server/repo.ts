import "server-only";
import bcrypt from "bcryptjs";
import { addAudit, kvGet, kvSet, sql, uid } from "./db";
import { HttpError } from "./auth";
import { qualify } from "./ai";
import { markRead, sendTemplate, sendText, waConfigured } from "./whatsapp";
import { sendLeadEvent } from "./meta";
import { fill, statusOf } from "../ai";
import { normalizeCity, routeLead } from "../routing";
import type { AuditEntry, BotSettings, KnowledgeItem, Lead, LeadSource, Message, User } from "../types";

const WINDOW_MS = 24 * 3600_000;
type Row = Record<string, unknown>;
const clean = <T>(r: Row) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? undefined : v])) as T;
const toLead = (r: Row) => clean<Lead>(r);
const toMsg = (r: Row) => { const { sender, leadId, waMessageId, ...rest } = r; void waMessageId; return clean<Message>({ ...rest, leadId, from: sender }); };

export async function getUsers(): Promise<User[]> {
  const rows = await sql()`select id, name, username, role, active, territory, cities from users order by role, name`;
  return rows.map((r) => ({ ...clean<User>(r), password: "" }));
}
export const getBot = async () => (await kvGet<BotSettings>("bot"))!;
export const getKnowledge = async () => (await sql()`select * from knowledge order by title`).map((r) => r as unknown as KnowledgeItem);
async function getLead(id: string) {
  const r = await sql()`select * from leads where id = ${id}`;
  if (!r[0]) throw new HttpError(404, "Lead tidak ditemukan");
  return toLead(r[0]);
}

/** Seluruh data yang dibutuhkan UI, disaring sesuai role. */
export async function getState(user: User) {
  const db = sql();
  const isAgent = user.role === "agent";
  const leads = (isAgent ? await db`select * from leads where agent_id = ${user.id}` : await db`select * from leads`).map(toLead);
  const ids = leads.map((l) => l.id);
  const messages = ids.length ? (await db`select * from messages where lead_id in ${db(ids)} order by at`).map(toMsg) : [];
  const audit = isAgent ? [] : ((await db`select * from audit order by at desc limit 300`) as unknown as AuditEntry[]).map((a) => clean<AuditEntry>(a as unknown as Row));
  return { sessionUserId: user.id, users: await getUsers(), bot: await getBot(), knowledge: isAgent ? [] : await getKnowledge(), leads, messages, audit };
}

async function insertMessage(m: Omit<Message, "id"> & { waMessageId?: string }) {
  const db = sql();
  const { from, ...rest } = m;
  const row = { id: uid(), sender: from, waMessageId: null, author: null, status: null, template: false, knowledge: null, ...rest };
  await db`insert into messages ${db(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === undefined ? null : v])))}`;
}
const systemMsg = (leadId: string, text: string) => insertMessage({ leadId, from: "system", text, at: Date.now() });

/** Lead baru lengkap (WARM): AI berhenti, route ke agent / Admin Queue, kirim event CAPI. */
async function onWarm(lead: Lead) {
  const db = sql();
  const users = await getUsers();
  const r = routeLead(lead.city, users);
  const now = Date.now();
  if (r.kind === "assigned") {
    await db`update leads set agent_id = ${r.agent.id}, in_queue = false, queue_reason = null, assigned_at = ${now}, warm_at = coalesce(warm_at, ${now}) where id = ${lead.id}`;
    await systemMsg(lead.id, `Auto-assign ke ${r.agent.name} (${r.agent.territory}) — domisili "${lead.city}"`);
    await addAudit("Sistem", "Auto assignment", lead.id, `${r.agent.name} (${r.agent.territory})`);
  } else {
    await db`update leads set in_queue = true, queue_reason = ${r.reason}, warm_at = coalesce(warm_at, ${now}) where id = ${lead.id}`;
    await systemMsg(lead.id, `Masuk Admin Queue: ${r.reason}`);
    await addAudit("Sistem", "Masuk Admin Queue", lead.id, r.reason);
  }
  try { await sendLeadEvent(lead); } catch (e) { console.error("CAPI error", e); }
}

export interface Inbound {
  phone: string; text: string; source: LeadSource; campaign?: string; adId?: string; ctwaClid?: string; adHeadline?: string; sourceUrl?: string;
  waMessageId?: string; profileName?: string; simulate?: boolean;
}

/** Pipeline pesan masuk: simpan → AI kualifikasi → balas → handover & routing. */
export async function handleInbound(inb: Inbound): Promise<string> {
  const db = sql();
  if (inb.waMessageId) {
    const dup = await db`select lead_id from messages where wa_message_id = ${inb.waMessageId}`;
    if (dup[0]) return dup[0].leadId as string; // idempotent: webhook bisa dikirim ulang oleh Meta
  }
  const now = Date.now();
  const phone = inb.phone.startsWith("+") ? inb.phone : `+${inb.phone.replace(/\D/g, "")}`;
  let rows = await db`select * from leads where phone = ${phone}`;
  const isFirst = !rows[0];
  if (isFirst) {
    const [{ n }] = await db`select nextval('lead_seq')::int as n`;
    rows = await db`insert into leads ${db({ id: `L-${n}`, phone, source: inb.source, campaign: inb.campaign ?? null, adId: inb.adId ?? null, ctwaClid: inb.ctwaClid ?? null, adHeadline: inb.adHeadline ?? null, sourceUrl: inb.sourceUrl ?? null, profileName: inb.profileName ?? null, aiActive: true, inQueue: false, createdAt: now, lastCustomerMsgAt: now })} on conflict (phone) do nothing returning *`;
    if (!rows[0]) rows = await db`select * from leads where phone = ${phone}`;
  } else {
    await db`update leads set last_customer_msg_at = ${now}, resolved = false where phone = ${phone}`;
  }
  let lead = toLead(rows[0]);
  await insertMessage({ leadId: lead.id, from: "customer", text: inb.text, at: now, waMessageId: inb.waMessageId });
  if (inb.waMessageId && waConfigured()) await markRead(inb.waMessageId);
  if (!lead.aiActive) return lead.id;

  const [bot, knowledge, users, history] = await Promise.all([
    getBot(), getKnowledge(), getUsers(),
    db`select * from messages where lead_id = ${lead.id} order by at`.then((r) => r.map(toMsg)),
  ]);
  const ai = await qualify({ lead, history, text: inb.text, bot, knowledge, cities: users.flatMap((u) => u.cities), isFirst });
  const patch = { name: lead.name ?? ai.name ?? null, city: lead.city ?? ai.city ?? null, unit: lead.unit ?? ai.unit ?? null };
  lead = { ...lead, ...clean<Partial<Lead>>(patch) };
  const warm = statusOf(lead) === "WARM";
  const reply = warm ? [ai.knowledge ? ai.reply : "", fill(bot.handover, lead)].filter(Boolean).join("\n\n") : ai.reply;

  let waId: string | undefined;
  if (!inb.simulate && waConfigured()) {
    try { waId = await sendText(phone, reply); } catch (e) { await systemMsg(lead.id, `Gagal mengirim balasan AI: ${(e as Error).message}`); }
  }
  await insertMessage({ leadId: lead.id, from: "ai", text: reply, at: Date.now(), knowledge: ai.knowledge, waMessageId: waId, status: waId ? "sent" : undefined });
  await db`update leads set name = ${patch.name}, city = ${patch.city}, unit = ${patch.unit}, ai_active = ${!warm} where id = ${lead.id}`;
  if (warm) {
    await systemMsg(lead.id, "Data lengkap → WARM. AI handover, balasan otomatis dihentikan.");
    await onWarm(lead);
  }
  return lead.id;
}

export async function updateMessageStatus(waMessageId: string, status: string) {
  const order = ["sent", "delivered", "read"];
  if (!order.includes(status)) return;
  await sql()`update messages set status = ${status} where wa_message_id = ${waMessageId} and (status is null or array_position(array['sent','delivered','read'], status) < ${order.indexOf(status) + 1})`;
}

function assertCanTouch(user: User, lead: Lead) {
  if (user.role === "agent" && lead.agentId !== user.id) throw new HttpError(403, "Akses ditolak: lead bukan milik Anda.");
}

export async function reply(user: User, leadId: string, text: string) {
  const lead = await getLead(leadId);
  assertCanTouch(user, lead);
  if (Date.now() - lead.lastCustomerMsgAt >= WINDOW_MS) throw new HttpError(400, "Di luar 24-hour customer service window. Gunakan template yang sudah di-approve Meta.");
  const waId = waConfigured() ? await sendText(lead.phone, text) : undefined;
  await sql()`update leads set ai_active = false where id = ${leadId}`;
  await insertMessage({ leadId, from: "agent", author: user.name, text, at: Date.now(), status: "sent", waMessageId: waId });
}

export async function replyTemplate(user: User, leadId: string, name: string, language: string, body: string, params: string[]) {
  const lead = await getLead(leadId);
  assertCanTouch(user, lead);
  if (!waConfigured()) throw new HttpError(400, "WhatsApp belum terhubung");
  const waId = await sendTemplate(lead.phone, name, language, params);
  const text = params.reduce((t, p, i) => t.replace(`{{${i + 1}}}`, p), body);
  await sql()`update leads set ai_active = false where id = ${leadId}`;
  await insertMessage({ leadId, from: "agent", author: user.name, text, at: Date.now(), status: "sent", template: true, waMessageId: waId });
}

export async function setAi(user: User, leadId: string, on: boolean) {
  const lead = await getLead(leadId);
  assertCanTouch(user, lead);
  await sql()`update leads set ai_active = ${on} where id = ${leadId}`;
  await systemMsg(leadId, on ? `Bot diaktifkan kembali oleh ${user.name}` : `Human takeover: ${user.name} mengambil alih percakapan, bot berhenti`);
  await addAudit(user.name, on ? "Aktifkan bot" : "Human takeover", leadId);
}

export async function setResolved(user: User, leadId: string, v: boolean) {
  const lead = await getLead(leadId);
  assertCanTouch(user, lead);
  await sql()`update leads set resolved = ${v} where id = ${leadId}`;
  await systemMsg(leadId, v ? `Percakapan ditandai selesai oleh ${user.name}` : `Percakapan dibuka kembali oleh ${user.name}`);
}

export async function assignLead(user: User, leadId: string, agentId: string) {
  const lead = await getLead(leadId);
  const users = await getUsers();
  const ag = users.find((u) => u.id === agentId && u.role === "agent");
  if (!ag) throw new HttpError(400, "Agent tidak ditemukan");
  const prev = users.find((u) => u.id === lead.agentId);
  await sql()`update leads set agent_id = ${agentId}, in_queue = false, queue_reason = null, ai_active = false, assigned_at = ${Date.now()} where id = ${leadId}`;
  await systemMsg(leadId, `${prev ? "Reassign" : "Assign"} ke ${ag.name} oleh ${user.name}`);
  await addAudit(user.name, prev ? "Reassign agent" : "Assign agent", leadId, `${prev ? prev.name + " → " : ""}${ag.name}`);
}

export async function updateLead(user: User, leadId: string, patch: { name?: string; city?: string; unit?: string }) {
  const lead = { ...(await getLead(leadId)), ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v)) } as Lead;
  await sql()`update leads set name = ${lead.name ?? null}, city = ${lead.city ?? null}, unit = ${lead.unit ?? null} where id = ${leadId}`;
  await addAudit(user.name, "Ubah data lead", leadId, Object.entries(patch).map(([k, v]) => `${k}: ${v}`).join(", "));
  if (!lead.agentId && statusOf(lead) === "WARM") {
    await sql()`update leads set ai_active = false where id = ${leadId}`;
    await onWarm(lead);
  }
}

export async function saveUser(actor: User, u: User) {
  const db = sql();
  if (!u.name.trim() || !u.username.trim()) throw new HttpError(400, "Nama dan username wajib diisi");
  const users = await getUsers();
  const exists = users.find((x) => x.id === u.id);
  if (!exists && u.password.length < 6) throw new HttpError(400, "Password minimal 6 karakter");
  if (exists && u.password && u.password.length < 6) throw new HttpError(400, "Password minimal 6 karakter");
  if (users.some((x) => x.id !== u.id && x.username.toLowerCase() === u.username.toLowerCase())) throw new HttpError(400, `Username "${u.username}" sudah dipakai`);
  if (u.role === "agent") for (const c of u.cities) {
    const owner = users.find((x) => x.id !== u.id && x.role === "agent" && x.cities.some((y) => normalizeCity(y) === normalizeCity(c)));
    if (owner) throw new HttpError(400, `Domisili "${c}" sudah masuk wilayah ${owner.name} (${owner.territory})`);
  }
  if (u.id === actor.id && (u.role !== "admin" || !u.active)) throw new HttpError(400, "Tidak bisa menurunkan role / menonaktifkan akun yang sedang dipakai");
  const row = { name: u.name.trim(), username: u.username.trim().toLowerCase(), role: u.role, active: u.active, territory: u.role === "agent" ? u.territory ?? null : null, cities: db.json(u.role === "agent" ? u.cities : []) };
  if (exists) {
    await db`update users set ${db(row)} where id = ${u.id}`;
    if (u.password) await db`update users set password_hash = ${await bcrypt.hash(u.password, 10)} where id = ${u.id}`;
  } else {
    await db`insert into users ${db({ id: `u-${uid().slice(0, 8)}`, ...row, passwordHash: await bcrypt.hash(u.password, 10) })}`;
  }
  await addAudit(actor.name, exists ? "Ubah user" : "Tambah user", `${u.name} (${u.username})`, u.role === "agent" ? `Agent ${u.territory ?? ""}: ${u.cities.join(", ")}` : "Admin");
}

export async function deleteUser(actor: User, id: string) {
  if (id === actor.id) throw new HttpError(400, "Tidak bisa menghapus akun sendiri");
  const db = sql();
  const [u] = await db`select name from users where id = ${id}`;
  await db`update leads set agent_id = null, in_queue = true, queue_reason = ${`Agent ${u?.name} dihapus`} where agent_id = ${id}`;
  await db`delete from users where id = ${id}`;
  await addAudit(actor.name, "Hapus user", (u?.name as string) ?? id, "Leads miliknya dipindah ke Admin Queue");
}

export async function saveKnowledge(actor: User, k: KnowledgeItem) {
  const db = sql();
  const row = { id: k.id, title: k.title, category: k.category, keywords: db.json(k.keywords), answer: k.answer, active: k.active };
  await db`insert into knowledge ${db(row)} on conflict (id) do update set title = excluded.title, category = excluded.category, keywords = excluded.keywords, answer = excluded.answer, active = excluded.active`;
  await addAudit(actor.name, "Simpan knowledge", k.title);
}
export async function deleteKnowledge(actor: User, id: string) {
  await sql()`delete from knowledge where id = ${id}`;
  await addAudit(actor.name, "Hapus knowledge", id);
}
export async function updateBot(actor: User, patch: Partial<BotSettings>) {
  await kvSet("bot", { ...(await getBot()), ...patch });
  await addAudit(actor.name, "Ubah pengaturan chatbot", Object.keys(patch).join(", "));
}

export async function login(username: string, password: string) {
  const [u] = await sql()`select id, password_hash, active from users where username = ${username.trim().toLowerCase()}`;
  if (!u || !(await bcrypt.compare(password, u.passwordHash as string))) throw new HttpError(401, "Username atau password salah");
  if (!u.active) throw new HttpError(403, "Akun ini sedang nonaktif. Hubungi admin.");
  return u.id as string;
}
