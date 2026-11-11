import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { api } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { addAudit } from "@/lib/server/db";
import { exchangeCode } from "@/lib/server/meta";

export const GET = api(async (req: Request) => {
  const user = await requireUser("admin");
  const p = new URL(req.url).searchParams;
  const back = (q: string) => NextResponse.redirect(new URL(`/integrations?meta=${q}`, req.url));
  if (p.get("error") || !p.get("code")) return back("cancelled");
  if (p.get("state") !== cookies().get("meta_oauth_state")?.value) return back("invalid-state");
  await exchangeCode(p.get("code")!, new URL("/api/meta/oauth/callback", req.url).toString());
  await addAudit(user.name, "Hubungkan Meta Business", "Meta");
  return back("connected");
});
