# DIPO Lead CRM — Prototype Frontend

Prototype tampilan **AI WhatsApp Lead Management System — Mitsubishi DIPO**, dibangun dari workbook
*Project Plan AI WhatsApp Lead Management DIPO v1.0*.

Aplikasi punya dua mode:

- **Demo** (default, tanpa env var): data dummy di `localStorage` browser — untuk melihat tampilan.
- **Live** (setelah `DATABASE_URL` dll. di-set): database Postgres, login sungguhan, chatbot WhatsApp
  dengan AI Claude, auto-assign agent, sync hasil Meta Ads, dan Conversions API.
  Lihat **[SETUP.md](SETUP.md)** untuk langkah lengkapnya.

## Login demo (mode demo saja)

| Role | Username | Password | Akses |
|---|---|---|---|
| Admin | `admin` | `admin123` | Semua menu |
| Agent Jakarta | `jakarta` | `agent123` | Inbox & Leads miliknya saja |
| Agent lain | `medan`, `pekanbaru`, `surabaya`, `padang` | `agent123` | Inbox & Leads miliknya saja |

## Aturan status

- **COLD**: nama, domisili, atau unit belum lengkap.
- **WARM**: nama, domisili, dan unit sudah lengkap. AI berhenti membalas, lalu lead otomatis
  diteruskan ke agent yang wilayahnya memuat domisili tersebut. Kalau tidak ada yang cocok,
  lead masuk **Admin Queue** untuk di-assign manual.

## Menu

| Menu | Role | Isi |
|---|---|---|
| Dashboard | Admin | KPI COLD/WARM/Admin Queue, leads per agent, sumber leads |
| Inbox | Admin, Agent | Chat, balas pesan, aturan 24 jam + template, human takeover |
| Leads | Admin, Agent | Tabel leads + filter + export CSV |
| Admin Queue | Admin | Lengkapi data & assign agent |
| Kelola Agent | Admin | Tambah/edit/hapus user, role akses, nama wilayah, daftar domisili, uji auto-assign |
| Knowledge Chatbot | Admin | Knowledge base (kata kunci → jawaban), persona, sapaan, pertanyaan, pesan handover, daftar unit |
| Simulator | Admin | Chat sebagai pelanggan untuk menguji AI + knowledge + auto-assign |
| Integrasi | Admin | Status WhatsApp & AI, callback webhook, login Facebook, hasil iklan, log Conversions API |
| Laporan, Audit Log | Admin | — |

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Deploy ke Vercel (gratis)

1. Login ke https://vercel.com pakai akun GitHub.
2. **Add New → Project** → pilih repo `dipo-lead-crm` → **Import**.
3. Framework otomatis terdeteksi **Next.js**. Klik **Deploy** (tanpa env var = mode demo).
4. Untuk mode live, ikuti [SETUP.md](SETUP.md).

## Struktur

```
src/lib/        types, seed (data dummy), store (state demo/live), routing (domisili → agent), mock AI
src/lib/server/ database, auth, WhatsApp, AI Claude, Meta (OAuth, insights, CAPI), pipeline pesan
src/app/api/    webhook WhatsApp, login, state, rpc, OAuth Meta, cron harian
src/app/(app)/  halaman-halaman setelah login
src/components/ AppShell (sidebar), komponen UI
```

`src/lib/routing.ts` dan `src/lib/ai.ts` berisi aturan bisnis yang nantinya dipindah ke backend.
AI di prototype ini masih mock berbasis kata kunci; di produksi knowledge + persona dikirim ke model AI sebagai konteks.

Data agent, domisili, dan knowledge di `src/lib/seed.ts` hanya contoh dan bisa diubah dari UI.
