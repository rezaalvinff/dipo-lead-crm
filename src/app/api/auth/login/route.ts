import { api } from "@/lib/server/http";
import { createSession } from "@/lib/server/auth";
import { addAudit } from "@/lib/server/db";
import { login } from "@/lib/server/repo";

export const POST = api(async (req: Request) => {
  const { username, password } = await req.json();
  const id = await login(String(username ?? ""), String(password ?? ""));
  await createSession(id);
  await addAudit(String(username), "Login", String(username));
  return { ok: true };
});
