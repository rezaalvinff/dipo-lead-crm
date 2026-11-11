import { api } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { kvGet, sql } from "@/lib/server/db";
import { getMetaConfig, metaAppConfigured } from "@/lib/server/meta";
import { phoneInfo, waConfigured } from "@/lib/server/whatsapp";
import { aiConfigured } from "@/lib/server/ai";

export const dynamic = "force-dynamic";

/** Status semua integrasi (tanpa pernah mengembalikan token). */
export const GET = api(async () => {
  await requireUser("admin");
  const { token, ...metaCfg } = await getMetaConfig();
  const capiLog = await sql()`select c.*, l.name as lead_name from capi_events c left join leads l on l.id = c.lead_id order by c.at desc limit 30`;
  return {
    whatsapp: { configured: waConfigured(), verifyTokenSet: Boolean(process.env.WHATSAPP_VERIFY_TOKEN), appSecretSet: Boolean(process.env.META_APP_SECRET), wabaSet: Boolean(process.env.WHATSAPP_WABA_ID), phone: await phoneInfo().catch(() => null) },
    ai: { configured: aiConfigured(), model: process.env.AI_MODEL || "claude-opus-5-5" },
    meta: { appConfigured: metaAppConfigured(), connected: Boolean(token || process.env.META_ACCESS_TOKEN), ...metaCfg },
    insights: (await kvGet("meta_insights")) ?? null,
    capiLog,
  };
});
