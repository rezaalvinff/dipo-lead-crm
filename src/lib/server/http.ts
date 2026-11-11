import "server-only";
import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { ensureDb, isLive } from "./db";

/** Bungkus handler API: pastikan mode live + DB siap, ubah error menjadi JSON. */
export function api<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      if (!isLive()) return NextResponse.json({ error: "Mode demo: DATABASE_URL belum di-set" }, { status: 503 });
      await ensureDb();
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: (e as Error).message || "Terjadi kesalahan server" }, { status: 500 });
    }
  };
}
