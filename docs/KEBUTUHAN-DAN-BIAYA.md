# Kebutuhan & Estimasi Biaya — AI WhatsApp Chatbot & Lead Tracking DIPO

Disusun 11 November 2026. Semua angka adalah **perkiraan** dari sumber publik (lihat bagian Sumber).
Cek ulang ke halaman harga resmi sebelum mengajukan anggaran.

---

## 1. Cara kerja sistem (sesuai blueprint)

```
[Pelanggan] ──(klik iklan CTWA / chat organik)──▶ [Meta WhatsApp Cloud API]
                                                        │ webhook JSON
                                                        ▼
                                   [Backend: webhook + logika bot + routing]
                                     │            │                 │
                                     ▼            ▼                 ▼
                     [PostgreSQL + pgvector]  [RAG + LLM]   [Realtime ke dashboard]
                      lead, sumber, riwayat,   cari konteks       │
                      embedding knowledge      FAQ/SOP → balas    ▼
                                                           [Dashboard CS (Next.js)]
                                                           inbox, human takeover
```

| Langkah | Yang terjadi |
|---|---|
| 1. Pesan masuk | Meta mengirim webhook. Nomor dari `messages[0].from`, nama dari `contacts[0].profile.name`. |
| 2. Atribusi | Ada `messages[0].referral` → **META_ADS** (simpan `source_id`/ad id, `headline`, `source_url`, `ctwa_clid`). Tidak ada → **ORGANIC**. |
| 3. RAG | Pertanyaan pelanggan diubah jadi embedding, dicari chunk FAQ/SOP paling mirip di pgvector. |
| 4. LLM | AI menjawab berdasarkan konteks tadi, sambil mengumpulkan nama, domisili, dan unit. |
| 5. Handover | Data lengkap → lead **WARM**, bot berhenti, lead dioper ke agent sesuai domisili (atau Admin Queue). |
| 6. Dashboard | Pesan muncul realtime di inbox. CS bisa **ambil alih** kapan saja atau mengaktifkan bot lagi. |
| 7. Konversi | Lead WARM dikirim ke Meta Conversions API sebagai offline conversion. |

**Semua langkah di atas sudah bisa dicoba di versi demo** (link Vercel, mode demo): chat masuk otomatis,
notifikasi, tab Bot/Antrean/Ditangani/Selesai, ambil alih, sumber konteks RAG di tiap jawaban bot,
panel atribusi + payload webhook, dan halaman Knowledge Base (RAG) untuk upload dokumen.

---

## 2. Pilihan arsitektur produksi

| | **Opsi A — Next.js all-in-one** (sudah ada di repo) | **Opsi B — sesuai blueprint** (FastAPI) |
|---|---|---|
| Backend | Next.js API routes (TypeScript) | Python FastAPI |
| Database | PostgreSQL + pgvector (Neon) | PostgreSQL + pgvector + Redis |
| Realtime | Polling 4 detik (bisa ditingkatkan ke SSE / layanan realtime) | WebSocket (Socket.io) |
| Hosting | Vercel Pro + Neon | VPS (DigitalOcean/Railway) + Docker |
| Status | Webhook, AI, routing, Meta login, CAPI sudah ditulis & dites lokal | Backend perlu ditulis ulang dalam Python |
| Kelebihan | Paling cepat jalan, tidak perlu kelola server | Realtime sejati, kontrol penuh, cocok untuk volume besar |
| Kekurangan | Batas waktu fungsi 60 detik, realtime via polling | Harus maintain server, backup, keamanan sendiri |

**Rekomendasi:** mulai pilot dengan **Opsi A** (sudah siap, biaya rendah). Pindah ke Opsi B kalau
volume chat sudah tinggi atau tim lebih nyaman dengan Python. Dashboard Next.js tetap dipakai di kedua opsi.

---

## 3. Yang perlu disiapkan

### A. Akun & legal (tanggung jawab DIPO)
- [ ] **Meta Business Portfolio** atas nama DIPO + **verifikasi bisnis** (dokumen legal perusahaan, website/domain resmi, nomor telepon bisnis).
- [ ] **Nomor WhatsApp baru** khusus chatbot: bisa menerima SMS/telepon OTP dan **belum terdaftar** di aplikasi WhatsApp / WhatsApp Business.
- [ ] **Display name** sesuai nama brand (disetujui Meta).
- [ ] **Meta Developer App** (tipe Business) + produk WhatsApp, Facebook Login for Business, Marketing API.
- [ ] **Halaman Kebijakan Privasi** di website DIPO (wajib untuk app Meta mode Live) dan dasar pemrosesan data pelanggan.
- [ ] Akses admin ke **Ad Account** dan **Dataset/Pixel** di Business Manager.
- [ ] Metode pembayaran (kartu kredit) yang terdaftar di Meta Business untuk tagihan WhatsApp.

### B. Layanan pihak ketiga
- [ ] **Anthropic Console** (API key Claude) + kartu kredit. Billing terpisah dari langganan Claude Pro.
- [ ] **Embedding API** untuk RAG, mis. Voyage AI (200 juta token pertama gratis).
- [ ] **Hosting**: Vercel Pro + Neon (Opsi A) atau VPS + Docker (Opsi B).
- [ ] **Domain** untuk dashboard, mis. `crm.dipo.co.id` (HTTPS wajib untuk webhook Meta).
- [ ] **GitHub** (sudah ada) — repository harus **private**.

### C. Konten & data operasional
- [ ] Dokumen knowledge: FAQ, SOP pembiayaan, test drive, servis, info unit, alamat showroom.
- [ ] Daftar agent + wilayah + **daftar domisili resmi** per wilayah.
- [ ] Persona & gaya bahasa bot, pesan sapaan & handover.
- [ ] **Template pesan WhatsApp** untuk follow-up di luar 24 jam (diajukan & di-approve di WhatsApp Manager).
- [ ] Link wa.me dengan penanda untuk Google Ads / organik (lihat SETUP.md).

### D. Pekerjaan teknis dari demo ke produksi
| Item | Status |
|---|---|
| Webhook WhatsApp, signature, anti-duplikat | ✅ sudah ada |
| AI Claude + kualifikasi + handover + routing domisili | ✅ sudah ada |
| Login Facebook, sync hasil iklan, Conversions API | ✅ sudah ada (perlu uji dengan akun asli) |
| RAG dengan **embedding + pgvector** di server | ⏳ demo pakai vektor kata di browser; server saat ini mengirim seluruh knowledge ke AI (cukup selama dokumen < ±50 halaman) |
| Upload PDF/DOCX + ekstraksi teks | ⏳ demo hanya .txt/.md/.csv |
| Realtime push (WebSocket/SSE) | ⏳ saat ini polling 4 detik |
| Redis (lock percakapan, rate limit) | ⏳ opsional, dibutuhkan di volume tinggi |
| Monitoring error (mis. Sentry), backup DB, uji keamanan | ⏳ sebelum go-live |
| UAT sesuai checklist di workbook (UAT-01 s.d. UAT-18) | ⏳ |

---

## 4. Estimasi biaya

Kurs dipakai: **Rp 18.000 / US$** (pembulatan ke atas dari Rp 17.750 per 31 Agustus 2026).

### 4.1 Biaya tetap bulanan (hosting)

| Komponen | Opsi A | Opsi B |
|---|---|---|
| Aplikasi | Vercel Pro **US$20/seat** ≈ Rp 360rb | VPS 4 GB ≈ US$24 ≈ Rp 430rb *(harga droplet belum terverifikasi)* |
| Database | Neon **US$5–19** ≈ Rp 90–340rb *(sumber berbeda)* | Managed PostgreSQL **US$15** ≈ Rp 270rb |
| Redis | — | Managed Valkey/Redis ≈ US$15 ≈ Rp 270rb |
| **Total** | **± Rp 450–700rb / bulan** | **± Rp 970rb / bulan** |

Domain: sekitar Rp 150–350rb per tahun *(perkiraan, belum dicek)*.

### 4.2 WhatsApp (Meta) — per pesan

| Jenis | Tarif Indonesia (per pesan) |
|---|---|
| Pesan masuk dari pelanggan | Gratis |
| Balasan dalam 24 jam (service) | **1.000 pesan gratis / nomor / bulan**, selebihnya berbayar (mulai 1 Okt 2026) |
| Semua pesan dalam *free entry point* iklan Click-to-WhatsApp | Gratis (72 jam; beberapa sumber menyebut hingga 7 hari) |
| Template Marketing (follow-up/promo) | **Rp 586** |
| Template Utility | **Rp 357** |

⚠️ Perubahan Oktober 2026 masih simpang siur antar sumber (termasuk tarif service di atas kuota gratis, yang
di sini diasumsikan sama dengan Utility). **Wajib dicek** di rate card resmi Meta. Belum termasuk PPN 11%.

### 4.3 AI (Claude) — per lead

Asumsi: ±5 balasan bot per lead; tiap balasan ±4.000 token konteks (di-cache), ±800 token baru, ±500 token output.

| Model | Harga (input / output per 1 juta token) | Per balasan | **Per lead** |
|---|---|---|---|
| Claude Opus 5.5 *(default di kode, paling pintar)* | US$4 / US$20 | ±US$0,014 | **± Rp 1.260** |
| Claude Sonnet 5.5 *(seimbang)* | US$2 / US$10 | ±US$0,007 | **± Rp 630** |
| Claude Haiku 5.5 *(paling hemat)* | US$0,10 / US$0,50 | ±US$0,0004 | **± Rp 40** |

Model bisa diganti kapan saja lewat env `AI_MODEL` tanpa ubah kode. Embedding (Voyage) praktis Rp 0
karena 200 juta token pertama gratis.

### 4.4 Simulasi total bulanan (Opsi A)

Asumsi: 60% lead dari iklan CTWA (gratis dalam free entry window), 40% organik; ±15 balasan (bot + agent)
per lead; 30% lead dikirimi 1 template marketing.

| | **1.000 lead / bulan** | **3.000 lead / bulan** |
|---|---|---|
| Hosting (Opsi A) | Rp 450–700rb | Rp 450–700rb |
| WhatsApp service berbayar | 5.000 × Rp 357 ≈ Rp 1,8 jt | 17.000 × Rp 357 ≈ Rp 6,1 jt |
| WhatsApp template marketing | 300 × Rp 586 ≈ Rp 180rb | 900 × Rp 586 ≈ Rp 530rb |
| AI — Sonnet 5.5 | ≈ Rp 630rb | ≈ Rp 1,9 jt |
| AI — Opus 5.5 (alternatif) | ≈ Rp 1,3 jt | ≈ Rp 3,8 jt |
| **Total (dengan Sonnet)** | **± Rp 3–3,3 jt** | **± Rp 8,9–9,2 jt** |
| **Total (dengan Opus)** | **± Rp 3,7–3,9 jt** | **± Rp 10,8–11,1 jt** |

Belum termasuk: budget iklan Meta/Google, PPN, biaya developer/vendor, dan Vercel seat tambahan.
Komponen terbesar adalah **WhatsApp**, jadi porsi lead dari iklan CTWA dan jumlah balasan per lead
paling berpengaruh ke total.

---

## 5. Urutan kerja yang disarankan

1. **Minggu 1** — Urus Meta Business + verifikasi, beli/siapkan nomor baru, buat Meta App, kumpulkan dokumen knowledge.
2. **Minggu 2** — Deploy Opsi A (database, env), sambungkan nomor ke webhook, isi knowledge & agent, uji dengan nomor internal.
3. **Minggu 3** — Tambah RAG embedding + pgvector, upload PDF, uji UAT dari workbook, uji CAPI dengan Test Event Code.
4. **Minggu 4** — Pilot terbatas (1–2 wilayah), pantau biaya harian di Meta & Anthropic Console, lalu go-live bertahap.

---

## Sumber

- Tarif WhatsApp Indonesia: [Cekat](https://cekat.ai/en/blog/panduan-harga-biaya-whatsapp-api-dan-omnichannel-di-indonesia), [ChatMaxima](https://chatmaxima.com/whatsapp-api-pricing/indonesia/), [Sleekflow](https://sleekflow.io/blog/whatsapp-business-price), [Go4whatsup](https://www.go4whatsup.com/indonesia/whatsapp-business-api-pricing/)
- Perubahan Oktober 2026: [YCloud](https://www.ycloud.com/blog/whatsapp-api-message-pricing-update-effective-october-1-2026), [MyOperator](https://myoperator.com/blog/whatsapp-api-pricing-october-2026-update), [Chronox](https://chronox.ai/blogs/whatsapp-api-service-message-pricing-changes-october-2026), [Intellicon](https://www.intellicon.io/blog/whatsapp-api-pricing-changes-october-2026-updates/)
- Hosting: [DigitalOcean PostgreSQL pricing](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/), [InfraTally](https://infratally.com/articles/digitalocean-managed-postgres-deep-dive/), [Vercel Pro](https://vercel.com/docs/plans/pro), [Neon](https://neon.tech/docs/guides/vercel-postgres-transition-guide)
- Embedding: [Voyage AI pricing](https://docs.voyageai.com/pricing)
- Kurs: [Bisnis.com, 31 Agustus 2026](https://finansial.bisnis.com/read/20260831/90/2000011/kurs-dolar-as-bca-bri-mandiri-dan-bni-hari-ini-31-agustus-2026)
- Harga Claude: daftar harga resmi Anthropic (platform.claude.com/pricing)
