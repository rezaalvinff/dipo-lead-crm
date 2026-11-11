import { api } from "@/lib/server/http";
import { HttpError } from "@/lib/server/auth";
import { sql } from "@/lib/server/db";
import { getMetaConfig, sendLeadEvent, syncInsights } from "@/lib/server/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Dijalankan Vercel Cron setiap hari: sync hasil iklan + kirim ulang event CAPI yang gagal. */
export const GET = api(async (req: Request) => {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` || !process.env.CRON_SECRET) throw new HttpError(401, "Unauthorized");
  const out: Record<string, unknown> = {};
  const cfg = await getMetaConfig();
  if (cfg.adAccountId) out.insights = await syncInsights().then((r) => r.campaigns.length).catch((e) => String(e));
  const pending = await sql()`select * from leads where name is not null and city is not null and unit is not null and (capi_status is null or capi_status = 'failed') and warm_at > ${Date.now() - 7 * 86400_000} limit 50`;
  let sent = 0;
  for (const l of pending) if ((await sendLeadEvent(l as never).catch(() => null))?.ok) sent++;
  out.capiRetried = sent;
  return out;
});
