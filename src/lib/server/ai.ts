import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { expectingField, extractFields, matchKnowledge, nextQuestion } from "../ai";
import type { BotSettings, KnowledgeItem, Lead, Message } from "../types";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = () => process.env.AI_MODEL || "claude-opus-5-5";

const Reply = z.object({
  name: z.string().nullable().describe("Nama pelanggan jika sudah disebut, selain itu null"),
  city: z.string().nullable().describe("Kota/kabupaten domisili pelanggan jika sudah disebut, selain itu null"),
  unit: z.string().nullable().describe("Unit Mitsubishi yang diminati, 'Belum tahu' jika pelanggan belum tahu, selain itu null"),
  reply: z.string().describe("Balasan WhatsApp untuk pelanggan"),
  knowledge_used: z.string().nullable().describe("Judul knowledge yang dipakai untuk menjawab, atau null"),
});

export interface AiTurn { name?: string; city?: string; unit?: string; reply: string; knowledge?: string }

interface Ctx { lead: Lead; history: Message[]; text: string; bot: BotSettings; knowledge: KnowledgeItem[]; cities: string[]; isFirst: boolean }

/** Kualifikasi lead + balasan. Memakai Claude jika ANTHROPIC_API_KEY tersedia, selain itu mock rule-based. */
export async function qualify(ctx: Ctx): Promise<AiTurn> {
  if (aiConfigured()) {
    try {
      return await claudeTurn(ctx);
    } catch (e) {
      console.error("AI error, fallback ke mock:", e);
    }
  }
  return mockTurn(ctx);
}

function mockTurn({ lead, text, bot, knowledge, cities, isFirst }: Ctx): AiTurn {
  const kb = matchKnowledge(text, knowledge);
  const expecting = !isFirst && !kb && !text.includes("?") ? expectingField(lead) : undefined;
  const ex = extractFields(text, cities, bot.units, expecting);
  const merged = { ...lead, name: lead.name ?? ex.name, city: lead.city ?? ex.city, unit: lead.unit ?? ex.unit };
  const reply = [isFirst ? bot.greeting : "", kb?.answer ?? "", nextQuestion(merged, bot)].filter(Boolean).join("\n\n");
  return { name: ex.name, city: ex.city, unit: ex.unit, reply, knowledge: kb?.title };
}

let client: Anthropic | null = null;

async function claudeTurn({ lead, history, bot, knowledge, cities, isFirst }: Ctx): Promise<AiTurn> {
  client ??= new Anthropic();
  const kb = knowledge.filter((k) => k.active).map((k) => `### ${k.title}\n${k.answer}`).join("\n\n");
  // System prompt stabil (tanpa data per-pelanggan) supaya bisa di-cache.
  const system = `${bot.persona}

## Tugas
Kamu membalas chat WhatsApp pelanggan Mitsubishi DIPO. Kumpulkan tiga data secara natural, satu pertanyaan per pesan:
1. Nama pelanggan
2. Domisili (kota/kabupaten)
3. Unit Mitsubishi yang diminati
Nomor telepon sudah diketahui dari WhatsApp, jangan ditanyakan.
Jika pelanggan bertanya, jawab hanya berdasarkan Knowledge di bawah. Jika tidak ada di Knowledge, katakan tim sales akan membantu menjelaskan. Jangan mengarang harga, promo, atau stok.

## Gaya pertanyaan (ikuti maknanya, boleh disesuaikan)
- Sapaan pertama: ${bot.greeting}
- Tanya nama: ${bot.askName}
- Tanya domisili: ${bot.askCity}
- Tanya unit: ${bot.askUnit}

## Aturan field
- Isi name/city/unit hanya jika pelanggan benar-benar menyebutkannya di percakapan. Jangan menebak.
- city: jika cocok dengan salah satu domisili terdaftar (termasuk singkatan, mis. "jaksel" = "Jakarta Selatan"), tulis persis seperti di daftar. Jika tidak cocok, tulis nama kota yang disebut pelanggan dengan huruf kapital di awal kata. Jangan mengganti dengan kota terdekat.
- unit: pilih dari daftar unit jika cocok; tulis "Belum tahu" jika pelanggan belum tahu.
- reply: singkat (maks. 3 kalimat), bahasa Indonesia, tanpa markdown. Jangan tulis pesan handover; sistem akan mengirimnya otomatis saat data lengkap.

## Domisili terdaftar
${cities.join(", ") || "(belum ada)"}

## Daftar unit
${bot.units.join(", ")}

## Knowledge
${kb || "(kosong)"}`;

  const messages: Anthropic.Beta.BetaMessageParam[] = history
    .filter((m) => m.from !== "system")
    .slice(-30)
    .map((m): Anthropic.Beta.BetaMessageParam => ({ role: m.from === "customer" ? "user" : "assistant", content: m.text }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  const state = `Data yang sudah diketahui: nama=${lead.name ?? "-"}, domisili=${lead.city ?? "-"}, unit=${lead.unit ?? "-"}.${isFirst ? " Ini pesan pertama pelanggan, awali dengan sapaan." : ""}`;
  messages.push({ role: "user", content: `[catatan sistem] ${state}` });

  const res = await client.beta.messages.parse({
    model: MODEL(),
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages,
    output_config: { effort: "low", format: betaZodOutputFormat(Reply) },
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error(`AI tidak memberi output (${res.stop_reason})`);
  const o = res.parsed_output;
  return { name: o.name ?? undefined, city: o.city ?? undefined, unit: o.unit ?? undefined, reply: o.reply, knowledge: o.knowledge_used ?? undefined };
}
