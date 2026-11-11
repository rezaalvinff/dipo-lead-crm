# DIPO Lead CRM — Prototype Frontend

Prototype tampilan **AI WhatsApp Lead Management System — Mitsubishi DIPO**, dibangun dari workbook
*Project Plan AI WhatsApp Lead Management DIPO v1.0*.

> ⚠️ **Mode demo.** Ini frontend saja: semua data dummy, tersimpan di `localStorage` browser masing-masing.
> Belum ada backend, database, WhatsApp Cloud API, AI API, maupun Meta CAPI.

## Fitur yang bisa dicoba

| Halaman | Isi | Ref. |
|---|---|---|
| Login | Pilih role: Super Admin, Admin Pusat, atau Sales Agent (per wilayah) | FR-019 |
| Dashboard | KPI Total/COLD/WARM/Admin Queue, workload sales, sumber leads | FR-021 |
| Inbox | Unified inbox, riwayat chat, balas, human takeover, aturan 24 jam + template | FR-005, 016–018 |
| Leads | Tabel + cari/filter + export CSV | FR-022 |
| Admin Queue | Lengkapi data, assign ke sales (COLD → WARM) | FR-014, 015 |
| Sales Agent | Availability & kapasitas | FR-020 |
| Routing Wilayah | Mapping kota exact-match + uji routing | FR-012, 013 |
| Laporan | Per sumber, per sales, minat unit | FR-023, 024 |
| Simulator | Chat sebagai pelanggan → AI kualifikasi (mock) → handover → routing | FR-006–010, 026 |
| Audit Log | Login, assignment, perubahan mapping/availability | FR-027 |
| Integrasi | Daftar env var yang dibutuhkan (Super Admin saja) | NFR-001 |
| Project Plan | Roadmap, fitur, timeline, UAT, risiko, role, biaya dari workbook | — |

Sales Agent hanya melihat leads miliknya sendiri (UAT-14).

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

## Deploy ke Vercel (gratis)

1. Login ke https://vercel.com pakai akun GitHub.
2. **Add New → Project** → pilih repo `dipo-lead-crm` → **Import**.
3. Framework otomatis terdeteksi **Next.js**. Tidak perlu env var. Klik **Deploy**.

## Struktur

```
src/lib/        types, seed (data dummy), store (state), routing engine, mock AI, permissions
src/app/(app)/  halaman-halaman setelah login
src/components/ AppShell (sidebar), komponen UI
```

`src/lib/routing.ts` dan `src/lib/ai.ts` berisi aturan bisnis (exact match, fallback Admin Queue,
handover setelah nama + domisili + unit lengkap) yang nantinya dipindah ke backend.

Mapping kota di `src/lib/seed.ts` hanya contoh — daftar resmi per agent masih perlu dikonfirmasi DIPO.
