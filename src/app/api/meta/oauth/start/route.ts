import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { api } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { loginUrl, metaAppConfigured } from "@/lib/server/meta";

export const GET = api(async (req: Request) => {
  await requireUser("admin");
  if (!metaAppConfigured()) return NextResponse.redirect(new URL("/integrations?meta=no-app", req.url));
  const state = randomBytes(16).toString("hex");
  cookies().set("meta_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return NextResponse.redirect(loginUrl(new URL("/api/meta/oauth/callback", req.url).toString(), state));
});
