import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sql } from "./db";
import type { User } from "../types";

const COOKIE = "dipo_session";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET (min. 32 karakter acak) wajib di-set.");
  return s;
}
const key = () => new TextEncoder().encode(secret());

export async function createSession(userId: string) {
  const token = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("7d").sign(key());
  cookies().set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

/** User yang sedang login (tanpa password), atau null. */
export async function currentUser(): Promise<User | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const rows = await sql()`select id, name, username, role, active, territory, cities from users where id = ${payload.sub!}`;
    const u = rows[0];
    if (!u || !u.active) return null;
    return { ...(u as unknown as User), password: "" };
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireUser(role?: "admin") {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Silakan login ulang");
  if (role && u.role !== role) throw new HttpError(403, "Akses ditolak");
  return u;
}

/** Enkripsi AES-256-GCM untuk token yang disimpan di database (mis. token Meta). */
export function encrypt(plain: string) {
  const k = createHash("sha256").update(secret()).digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(blob: string) {
  const [iv, tag, enc] = blob.split(".").map((s) => Buffer.from(s, "base64"));
  const k = createHash("sha256").update(secret()).digest();
  const d = createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
