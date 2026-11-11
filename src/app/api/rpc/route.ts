import { api } from "@/lib/server/http";
import { HttpError, requireUser } from "@/lib/server/auth";
import * as repo from "@/lib/server/repo";
import * as meta from "@/lib/server/meta";
import { listTemplates, sendText, waConfigured } from "@/lib/server/whatsapp";
import { sql } from "@/lib/server/db";
import type { LeadSource } from "@/lib/types";

export const maxDuration = 60;

/** Satu endpoint aksi. Aksi tanpa tanda (*) khusus admin. */
export const POST = api(async (req: Request) => {
  const { action, args = {} } = await req.json();
  const user = await requireUser();
  const admin = () => { if (user.role !== "admin") throw new HttpError(403, "Akses ditolak"); };

  switch (action) {
    // (*) boleh untuk agent — pengecekan kepemilikan lead ada di repo
    case "reply": return repo.reply(user, args.leadId, String(args.text).slice(0, 4000));
    case "replyTemplate": return repo.replyTemplate(user, args.leadId, args.name, args.language, args.body, args.params ?? []);
    case "setAi": return repo.setAi(user, args.leadId, Boolean(args.on));
    case "setResolved": return repo.setResolved(user, args.leadId, Boolean(args.v));
    case "templates": return { templates: await listTemplates() };

    case "assignLead": admin(); return repo.assignLead(user, args.leadId, args.agentId);
    case "updateLead": admin(); return repo.updateLead(user, args.leadId, args.patch);
    case "saveUser": admin(); return repo.saveUser(user, args.user);
    case "deleteUser": admin(); return repo.deleteUser(user, args.id);
    case "saveKnowledge": admin(); return repo.saveKnowledge(user, args.item);
    case "deleteKnowledge": admin(); return repo.deleteKnowledge(user, args.id);
    case "updateBot": admin(); return repo.updateBot(user, args.patch);
    case "simulate": admin(); return { leadId: await repo.handleInbound({ phone: args.phone, text: args.text, source: args.source as LeadSource, simulate: true, campaign: args.source === "Meta Ads" ? "Simulator" : undefined }) };

    case "testWhatsapp": admin();
      if (!waConfigured()) throw new HttpError(400, "WhatsApp belum dikonfigurasi");
      return { id: await sendText(args.to, "Tes koneksi dari DIPO Lead CRM ✅") };
    case "metaAdAccounts": admin(); return { accounts: await meta.listAdAccounts() };
    case "metaDatasets": admin(); return { datasets: await meta.listDatasets(args.adAccountId) };
    case "metaSaveSettings": admin(); {
      const allowed = ["adAccountId", "adAccountName", "datasetId", "datasetName", "autoSend", "ctwaEventName", "crmEventName", "testEventCode"] as const;
      await meta.saveMetaConfig(Object.fromEntries(allowed.filter((k) => k in args).map((k) => [k, args[k]])));
      return { ok: true };
    }
    case "metaSync": admin(); return meta.syncInsights(args.datePreset);
    case "metaDisconnect": admin(); return meta.disconnect();
    case "capiResend": admin(); {
      const [row] = await sql()`select * from leads where id = ${args.leadId}`;
      if (!row) throw new HttpError(404, "Lead tidak ditemukan");
      return meta.sendLeadEvent(row as never, { force: true });
    }
    default: throw new HttpError(400, `Aksi tidak dikenal: ${action}`);
  }
});
