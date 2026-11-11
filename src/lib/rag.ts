import type { KnowledgeItem } from "./types";

/**
 * RAG mini untuk mode demo: potong dokumen jadi chunk, ubah jadi vektor kata (TF),
 * lalu cari chunk paling mirip dengan cosine similarity.
 * Di produksi: embedding API (mis. Voyage) + pgvector, dengan alur yang sama.
 */

const STOP = new Set("yang dan di ke dari ini itu untuk dengan ada apa saja kak min ya bisa saya aku kami kita mau atau juga pak bu bapak ibu sudah belum akan tidak gak ga nya lah kah pun the a of halo hai tolong mohon berapa gimana bagaimana".split(" "));

export const tokenize = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => w.replace(/(nya|kah|lah)$/, ""));

/** Pecah kalimat di . ! ? yang diikuti spasi + huruf kapital/angka (tidak memotong "08.00"). */
export const splitSentences = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-Z0-9("])/).map((x) => x.trim()).filter(Boolean);

export interface Chunk { docId: string; title: string; index: number; text: string }
export interface Hit extends Chunk { score: number }

export function chunkDoc(doc: KnowledgeItem, size = 420): Chunk[] {
  // Satu paragraf = satu chunk; paragraf yang terlalu panjang dipecah per kalimat.
  const chunks: string[] = [];
  for (const para of doc.answer.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean)) {
    if (para.length <= size) { chunks.push(para); continue; }
    let cur = "";
    for (const sent of splitSentences(para).map((x) => x + " ")) {
      if ((cur + sent).length > size && cur) { chunks.push(cur.trim()); cur = sent; } else cur += sent;
    }
    if (cur.trim()) chunks.push(cur.trim());
  }
  return chunks.map((text, index) => ({ docId: doc.id, title: doc.title, index, text }));
}

function vec(tokens: string[]) {
  const v = new Map<string, number>();
  for (const t of tokens) v.set(t, (v.get(t) ?? 0) + 1);
  return v;
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0;
  a.forEach((x, k) => { na += x * x; const y = b.get(k); if (y) dot += x * y; });
  b.forEach((y) => { nb += y * y; });
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function retrieve(query: string, docs: KnowledgeItem[], k = 3): Hit[] {
  const q = tokenize(query);
  if (!q.length) return [];
  const chunks = docs.filter((d) => d.active).flatMap((d) => chunkDoc(d));
  const toks = chunks.map((c) => tokenize(`${c.title} ${docs.find((d) => d.id === c.docId)?.keywords.join(" ") ?? ""} ${c.text}`));
  // IDF: kata yang muncul di banyak chunk (mis. "kredit") bobotnya lebih kecil daripada kata spesifik ("dokumen").
  const df = new Map<string, number>();
  toks.forEach((t) => new Set(t).forEach((w) => df.set(w, (df.get(w) ?? 0) + 1)));
  const idf = (w: string) => Math.log(1 + chunks.length / (1 + (df.get(w) ?? 0)));
  const weigh = (v: Map<string, number>) => { v.forEach((x, w) => v.set(w, x * idf(w))); return v; };
  const qv = weigh(vec(q));
  return chunks.map((c, i) => ({ ...c, score: cosine(qv, weigh(vec(toks[i]))) }))
    .filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

export const RAG_THRESHOLD = 0.16;

/** Jawaban dari konteks teratas (mock LLM): kalimat paling relevan dari chunk terbaik + kalimat sesudahnya. */
export function answerFrom(hits: Hit[], query = "") {
  const top = hits[0];
  if (!top || top.score < RAG_THRESHOLD) return undefined;
  const sentences = splitSentences(top.text);
  const q = new Set(tokenize(query));
  let best = 0, bestScore = -1;
  sentences.forEach((sen, i) => { const sc = tokenize(sen).filter((w) => q.has(w)).length; if (sc > bestScore) { best = i; bestScore = sc; } });
  // Tambah kalimat berikutnya hanya jika kalimat terbaik pendek.
  const take = sentences[best].length < 90 ? 2 : 1;
  return sentences.slice(best, best + take).join(" ").replace(/^[•\-]\s*/, "").replace(/^[A-Za-z ]{1,20}:\s*/, "").trim();
}

/** Apakah pesan terlihat seperti pertanyaan (bukan sekadar jawaban data)? */
export const looksLikeQuestion = (t: string) => /\?|\b(apa|berapa|gimana|bagaimana|bisa|ada|kapan|dimana|mana|boleh|info)\b/i.test(t);
