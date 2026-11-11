# Panduan Menyalakan Versi Live

Tanpa konfigurasi, aplikasi berjalan sebagai **demo** (data dummy di browser). Ikuti langkah di bawah
untuk mengaktifkan database, login sungguhan, chatbot WhatsApp, dan Meta Ads/CAPI.
Semua variabel diisi di **Vercel → Project → Settings → Environment Variables**, lalu **Redeploy**.
Daftar lengkap ada di `.env.example`.

> ⚠️ Paket **Vercel Hobby** hanya untuk penggunaan non-komersial dan cron hanya 1x sehari.
> Untuk operasional DIPO sebaiknya upgrade ke **Vercel Pro**.

---

## 1. Database + login (±5 menit)

1. Vercel → project → tab **Storage** → **Create Database** → pilih **Neon (Postgres)** → Free → hubungkan ke project.
   `DATABASE_URL` terisi otomatis.
2. Tambahkan env:
   - `AUTH_SECRET` → hasil `openssl rand -hex 32` (atau 32+ karakter acak)
   - `ADMIN_PASSWORD` → password admin pertama (min. 8 karakter)
   - `CRON_SECRET` → string acak
3. Redeploy. Buka aplikasi → login `admin` + `ADMIN_PASSWORD`. Tabel dibuat otomatis.
4. Buka **Kelola Agent** → tambahkan agent beserta wilayah & domisilinya.

## 2. AI chatbot (Claude)

1. Buat API key di https://console.anthropic.com (billing terpisah dari langganan Claude Pro).
2. Isi `ANTHROPIC_API_KEY`. Model default `claude-opus-5-5`.
   Tanpa key, bot tetap jalan dengan mode kata kunci.
3. Atur gaya bahasa & knowledge di menu **Knowledge Chatbot**, uji di **Simulator**.

## 3. Meta App

1. https://developers.facebook.com → **Create App** → tipe **Business** → hubungkan ke Business Portfolio DIPO.
2. Tambahkan produk: **WhatsApp**, **Facebook Login for Business**, **Marketing API**.
3. **App settings → Basic**: salin App ID & App Secret → `META_APP_ID`, `META_APP_SECRET`.

## 4. Nomor WhatsApp chatbot

Gunakan **nomor baru** yang belum terdaftar di aplikasi WhatsApp / WhatsApp Business.

1. Meta App → **WhatsApp → API Setup** → **Add phone number** → isi profil bisnis → verifikasi OTP.
2. Salin **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID` dan **WhatsApp Business Account ID** → `WHATSAPP_WABA_ID`.
3. Token permanen: **Business Settings → Users → System users** → buat system user (Admin) →
   **Assign assets**: app ini + WhatsApp account → **Generate token** dengan permission
   `whatsapp_business_messaging`, `whatsapp_business_management` → isi `WHATSAPP_TOKEN`.
4. Isi `WHATSAPP_VERIFY_TOKEN` dengan string acak bebas, lalu Redeploy.
5. Meta App → **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://DOMAIN-ANDA/api/whatsapp/webhook` (juga tertera di menu Integrasi)
   - Verify token: sama dengan `WHATSAPP_VERIFY_TOKEN` → **Verify and save**
   - Webhook fields → **Subscribe** ke `messages`.
6. Ubah app ke mode **Live** (App Mode di header dashboard Meta) supaya pelanggan umum bisa chat.
7. Menu **Integrasi → Kirim pesan tes** untuk mengecek. Lalu chat nomor itu dari HP lain: AI akan membalas.
8. Buat template pesan di **WhatsApp Manager → Message templates** untuk follow-up di luar 24 jam.
   Template yang sudah approved otomatis muncul di Inbox.

## 5. Meta Ads (hasil iklan) + Conversions API

1. Meta App → **Facebook Login for Business → Settings** → *Valid OAuth Redirect URIs*:
   `https://DOMAIN-ANDA/api/meta/oauth/callback`
2. (Disarankan) Buat **Configuration** dengan permission `ads_read`, `ads_management`, `business_management`,
   lalu isi Configuration ID ke `META_LOGIN_CONFIG_ID`.
3. Selama app belum lolos App Review, akun Facebook yang login harus punya role di app (Admin/Developer).
4. Redeploy → menu **Integrasi → Login dengan Facebook** → pilih **Ad account** dan **Dataset/Pixel**.
5. Klik **Sync sekarang** untuk melihat hasil iklan; selanjutnya sync otomatis tiap hari.
6. **Conversions API**: setiap lead yang menjadi **WARM** dikirim otomatis:
   - Lead dari iklan Click-to-WhatsApp → `action_source: business_messaging` + `ctwa_clid` (event default `LeadSubmitted`)
   - Lead lain → `action_source: system_generated` + nomor telepon ter-hash (event default `Lead`)
   Isi **Test event code** dari Events Manager → Test events untuk uji coba, lalu kosongkan saat produksi.
   Pastikan nama event dan kebijakan privasi/consent sudah sesuai ketentuan Meta sebelum go-live.

## 6. Melacak sumber Google

WhatsApp tidak mengirim info sumber untuk link biasa. Gunakan link dengan teks awal:
- Google Ads: `https://wa.me/62NOMOR?text=Halo%20DIPO%20[gads]`
- Google organik / website: `https://wa.me/62NOMOR?text=Halo%20DIPO%20[google]`

Lead tanpa penanda dan tanpa referral iklan dicatat sebagai **WhatsApp Organic**.

---

## Cara kerja singkat

```
Pelanggan → WhatsApp → /api/whatsapp/webhook (cek signature, anti-duplikat)
  → simpan pesan → AI (Claude + knowledge) balas & ekstrak nama/domisili/unit
  → lengkap = WARM → AI berhenti → domisili dicocokkan ke wilayah agent
      → cocok: auto-assign agent   → tidak cocok: Admin Queue
  → event WARM dikirim ke Meta Conversions API
Agent membalas dari Inbox → dikirim lewat nomor yang sama
```
