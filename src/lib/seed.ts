import type { AuditEntry, BotSettings, KnowledgeItem, Lead, LeadSource, Message, User } from "./types";
import { routeLead } from "./routing";
import { fill } from "./ai";

/** DATA DUMMY untuk prototype. Domisili per agent hanya contoh dan bisa diubah di menu Kelola Agent. */
export const seedUsers = (): User[] => [
  { id: "u-admin", name: "Admin Pusat", username: "admin", password: "admin123", role: "admin", active: true, cities: [] },
  { id: "u-mdn", name: "Rizky", username: "medan", password: "agent123", role: "agent", active: true, territory: "Medan", cities: ["Medan", "Binjai", "Deli Serdang"] },
  { id: "u-jkt", name: "Dewi", username: "jakarta", password: "agent123", role: "agent", active: true, territory: "Jakarta", cities: ["Jakarta", "Jakarta Timur", "Jakarta Barat", "Jakarta Utara", "Jakarta Pusat", "Jakarta Selatan", "Bogor", "Depok", "Bekasi", "Karawang"] },
  { id: "u-pku", name: "Fajar", username: "pekanbaru", password: "agent123", role: "agent", active: true, territory: "Pekanbaru", cities: ["Pekanbaru", "Kampar", "Dumai"] },
  { id: "u-sby", name: "Sinta", username: "surabaya", password: "agent123", role: "agent", active: true, territory: "Surabaya", cities: ["Surabaya", "Sidoarjo", "Gresik"] },
  { id: "u-pdg", name: "Andre", username: "padang", password: "agent123", role: "agent", active: true, territory: "Padang", cities: ["Padang", "Bukittinggi", "Pariaman"] },
];

export const seedBotSettings = (): BotSettings => ({
  persona: "Kamu adalah asisten virtual Mitsubishi DIPO. Gunakan bahasa Indonesia yang ramah, sopan, dan singkat. Panggil pelanggan dengan Bapak/Ibu. Tugas utama: kumpulkan nama, domisili (kota/kabupaten), dan unit yang diminati, lalu serahkan ke tim sales. Jawab pertanyaan hanya berdasarkan knowledge base. Jangan menyebutkan harga, angka cicilan, atau diskon spesifik.",
  greeting: "Halo, terima kasih sudah menghubungi Mitsubishi DIPO! 😊 Saya asisten virtual yang akan membantu meneruskan kebutuhan Bapak/Ibu ke tim sales kami.",
  askName: "Boleh saya tahu dengan Bapak/Ibu siapa?",
  askCity: "Terima kasih, {nama}. Saat ini berdomisili di kota/kabupaten mana?",
  askUnit: "Baik. Unit Mitsubishi apa yang sedang diminati? (contoh: Xpander, Pajero Sport, Xforce, Triton). Kalau belum tahu juga tidak apa-apa.",
  handover: "Terima kasih {nama}! Data Anda sudah kami terima (domisili: {domisili}, unit: {unit}). Tim sales kami akan segera melanjutkan percakapan ini. 🙏",
  units: ["Xpander", "Xpander Cross", "Pajero Sport", "Xforce", "Destinator", "Triton", "L300", "Outlander PHEV", "L100 EV"],
});

export const seedKnowledge = (): KnowledgeItem[] => [
  {
    id: "k-faq", title: "FAQ Umum", category: "FAQ", keywords: ["promo", "diskon"], active: true,
    answer: `Promo: Program promo berbeda untuk tiap unit dan wilayah, dan diperbarui setiap bulan. Detail promo terbaru akan dijelaskan langsung oleh tim sales kami.

Jam operasional: Showroom buka Senin sampai Sabtu pukul 08.00–17.00 dan Minggu pukul 09.00–15.00. (contoh, sesuaikan dengan jam resmi)

Tukar tambah: Kami melayani tukar tambah (trade-in) semua merek. Sales kami akan bantu taksiran harga mobil lama Bapak/Ibu.`,
  },
  {
    id: "k-kredit", title: "SOP Pembiayaan & Kredit", category: "SOP", keywords: ["kredit", "cicilan", "dp", "leasing"], active: true, fileName: "sop-pembiayaan.txt",
    answer: `Pembelian bisa tunai maupun kredit melalui leasing rekanan. Tim sales akan membantu simulasi DP dan cicilan sesuai tenor 1 sampai 5 tahun.

Syarat dan dokumen kredit perorangan yang perlu disiapkan: KTP suami dan istri, Kartu Keluarga, NPWP, serta slip gaji atau rekening koran 3 bulan terakhir. Untuk wiraswasta ditambah SIUP atau surat keterangan usaha.

Proses persetujuan kredit biasanya 1 sampai 3 hari kerja setelah berkas lengkap. Angka cicilan pasti akan diberikan sales melalui simulasi resmi.`,
  },
  {
    id: "k-testdrive", title: "SOP Test Drive & Showroom", category: "SOP", keywords: ["test drive", "coba"], active: true, fileName: "sop-test-drive.txt",
    answer: `Test drive bisa dilakukan di showroom DIPO terdekat, atau di rumah / lokasi pelanggan (home test drive) untuk area tertentu. Pelanggan cukup menyiapkan SIM A yang masih berlaku.

Jadwal test drive diatur oleh sales wilayah masing-masing. Unit test drive yang tersedia dapat berbeda di tiap cabang.

Lokasi showroom tersedia di Medan, Jakarta, Pekanbaru, Surabaya, dan Padang. Alamat lengkap akan dikirim oleh sales sesuai domisili pelanggan.`,
  },
  {
    id: "k-unit", title: "Info Unit Mitsubishi", category: "Produk", keywords: ["unit", "tipe", "varian", "mobil"], active: true, fileName: "brosur-ringkas.txt",
    answer: `Xpander dan Xpander Cross adalah MPV 7 penumpang untuk keluarga. Xforce adalah compact SUV 5 penumpang. Pajero Sport adalah SUV 7 penumpang bermesin diesel. Triton adalah double cabin dan single cabin untuk kebutuhan usaha maupun petualangan. L300 adalah kendaraan niaga pick-up.

Harga dan ketersediaan warna berbeda per wilayah dan tipe; sales akan mengirimkan price list resmi terbaru.`,
  },
];

const NAMES = ["Budi Santoso", "Siti Aminah", "Hendra", "Lina Marlina", "Agus Salim", "Rina", "Yusuf", "Maya Sari", "Doni Pratama", "Putri", "Fikri", "Nanda", "Irwan", "Wulan", "Taufik", "Ratna", "Bayu", "Citra", "Eko", "Fitri", "Gilang", "Hana", "Joko", "Kiki", "Lukman", "Mega", "Nur", "Oki", "Pandu", "Qori", "Rudi", "Sari"];
const CITIES = ["Medan", "Jakarta Selatan", "Pekanbaru", "Surabaya", "Padang", "Bekasi", "Bandung", "Depok", "Binjai", "Sidoarjo", "Bogor", "Semarang", "Karawang", "Dumai", "Jakarta Timur", "Bukittinggi"];
const UNITS = ["Xpander", "Pajero Sport", "Xforce", "Triton", "Xpander Cross", "L300", "Destinator", "Belum tahu"];
const SOURCES: LeadSource[] = ["Meta Ads", "Meta Ads", "Meta Ads", "Google Ads", "Google Ads", "Google Organic", "WhatsApp Organic", "Unknown"];
const CAMPAIGNS: Record<string, string> = { "Meta Ads": "CTWA - Promo Akhir Tahun", "Google Ads": "Search - Mitsubishi DIPO" };
const H = 3600_000;

export function seedData(now = Date.now()) {
  const users = seedUsers();
  const bot = seedBotSettings();
  const leads: Lead[] = [];
  const messages: Message[] = [];
  const audit: AuditEntry[] = [];
  let mid = 0;
  const msg = (m: Omit<Message, "id">) => messages.push({ ...m, id: `m${++mid}` });

  NAMES.forEach((name, i) => {
    const createdAt = now - (i * 7 + 2) * H - (i % 3) * 20 * 60_000;
    const city = CITIES[i % CITIES.length];
    const unit = UNITS[i % UNITS.length];
    const source = SOURCES[i % SOURCES.length];
    const incomplete = i % 6 === 4; // sebagian masih COLD (data belum lengkap)
    const id = `L-${1001 + i}`;
    const phone = `+62 81${2 + (i % 7)} ${String(1000 + i * 37).slice(0, 4)} ${String(5000 + i * 91).slice(0, 4)}`;

    const meta = source === "Meta Ads";
    const lead: Lead = {
      id, phone, source, campaign: CAMPAIGNS[source], profileName: name.split(" ")[0],
      adId: meta ? `1202${300000 + (i % 3) * 1111}` : undefined,
      adHeadline: meta ? ["Promo Akhir Tahun Mitsubishi", "Xforce — Test Drive Sekarang", "Pajero Sport DP Ringan"][i % 3] : undefined,
      sourceUrl: meta ? "https://fb.me/dipo-mitsubishi-ads" : undefined,
      ctwaClid: meta ? `ARAkLx${(i * 7919).toString(36)}` : undefined,
      resolved: i % 11 === 10,
      name: incomplete && i % 4 === 0 ? undefined : name,
      city: incomplete ? undefined : city,
      unit: incomplete ? undefined : unit,
      inQueue: false, aiActive: incomplete, createdAt, lastCustomerMsgAt: createdAt,
    };

    msg({ leadId: id, from: "customer", text: source === "Meta Ads" ? "Halo, saya mau tanya promo yang ada di iklan" : "Halo, mau tanya-tanya mobil Mitsubishi", at: createdAt });
    msg({ leadId: id, from: "ai", text: `${bot.greeting} ${bot.askName}`, at: createdAt + 20_000 });
    if (lead.name) {
      msg({ leadId: id, from: "customer", text: `Saya ${name}`, at: createdAt + 2 * 60_000 });
      msg({ leadId: id, from: "ai", text: fill(bot.askCity, lead), at: createdAt + 2 * 60_000 + 15_000 });
    }

    if (!incomplete) {
      msg({ leadId: id, from: "customer", text: `Di ${city}, minat ${unit === "Belum tahu" ? "masih bingung, belum tahu" : unit}`, at: createdAt + 4 * 60_000 });
      msg({ leadId: id, from: "ai", text: fill(bot.handover, lead), at: createdAt + 4 * 60_000 + 15_000 });
      msg({ leadId: id, from: "system", text: "Data lengkap → WARM. AI handover, balasan otomatis dihentikan.", at: createdAt + 4 * 60_000 + 16_000 });
      lead.lastCustomerMsgAt = createdAt + 4 * 60_000;

      const r = routeLead(city, users);
      if (r.kind === "assigned") {
        const ag = r.agent;
        lead.agentId = ag.id; lead.assignedAt = createdAt + 5 * 60_000;
        msg({ leadId: id, from: "system", text: `Auto-assign ke ${ag.name} (${ag.territory}) — domisili "${city}"`, at: lead.assignedAt });
        audit.push({ id: `a${audit.length + 1}`, at: lead.assignedAt, actor: "Sistem", action: "Auto assignment", target: id, detail: `${ag.name} (${ag.territory}) — "${city}"` });
        if (i % 2 === 0) {
          msg({ leadId: id, from: "agent", author: ag.name, text: `Halo ${name}, saya ${ag.name} dari Mitsubishi DIPO ${ag.territory}. Untuk ${unit === "Belum tahu" ? "pilihan unitnya" : unit} boleh saya bantu kirimkan informasi lengkapnya?`, at: createdAt + 30 * 60_000, status: "read" });
          if (i % 4 === 0) {
            msg({ leadId: id, from: "customer", text: "Boleh kak, sekalian simulasi kredit ya", at: createdAt + 45 * 60_000 });
            lead.lastCustomerMsgAt = createdAt + 45 * 60_000;
          }
        }
      } else {
        lead.inQueue = true; lead.queueReason = r.reason;
        msg({ leadId: id, from: "system", text: `Masuk Admin Queue: ${r.reason}`, at: createdAt + 5 * 60_000 });
        audit.push({ id: `a${audit.length + 1}`, at: createdAt + 5 * 60_000, actor: "Sistem", action: "Masuk Admin Queue", target: id, detail: r.reason });
      }
    }
    leads.push(lead);
  });

  audit.sort((a, b) => b.at - a.at);
  return { users, bot, knowledge: seedKnowledge(), leads, messages, audit };
}
