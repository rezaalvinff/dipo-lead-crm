import type { Agent, AuditEntry, Lead, LeadSource, Message, User } from "./types";

/**
 * DATA DUMMY untuk prototype. Mapping kota di bawah ini hanya contoh —
 * daftar resmi per agent wajib dikonfirmasi DIPO (sheet "Routing Wilayah").
 */
export const seedAgents = (): Agent[] => [
  { id: "ag-mdn", name: "Rizky (Medan)", territory: "Medan", cities: ["Medan"], available: true, capacity: 15 },
  { id: "ag-jkt", name: "Dewi (Jakarta)", territory: "Jakarta", cities: ["Jakarta Selatan", "Jakarta Pusat", "Jakarta Barat", "Jakarta Timur", "Jakarta Utara", "Jakarta"], available: true, capacity: 20 },
  { id: "ag-pku", name: "Fajar (Pekanbaru)", territory: "Pekanbaru", cities: ["Pekanbaru"], available: true, capacity: 12 },
  { id: "ag-sby", name: "Sinta (Surabaya)", territory: "Surabaya", cities: ["Surabaya"], available: false, capacity: 15 },
  { id: "ag-pdg", name: "Andre (Padang)", territory: "Padang", cities: ["Padang"], available: true, capacity: 4 },
];

export const seedUsers: User[] = [
  { id: "u-super", name: "Super Admin", role: "super_admin" },
  { id: "u-admin", name: "Admin Pusat", role: "admin" },
  { id: "u-mdn", name: "Rizky", role: "sales", agentId: "ag-mdn" },
  { id: "u-jkt", name: "Dewi", role: "sales", agentId: "ag-jkt" },
  { id: "u-pku", name: "Fajar", role: "sales", agentId: "ag-pku" },
  { id: "u-sby", name: "Sinta", role: "sales", agentId: "ag-sby" },
  { id: "u-pdg", name: "Andre", role: "sales", agentId: "ag-pdg" },
];

const NAMES = ["Budi Santoso", "Siti Aminah", "Hendra", "Lina Marlina", "Agus Salim", "Rina", "Yusuf", "Maya Sari", "Doni Pratama", "Putri", "Fikri", "Nanda", "Irwan", "Wulan", "Taufik", "Ratna", "Bayu", "Citra", "Eko", "Fitri", "Gilang", "Hana", "Joko", "Kiki", "Lukman", "Mega", "Nur", "Oki", "Pandu", "Qori", "Rudi", "Sari"];
const CITIES = ["Medan", "Jakarta Selatan", "Pekanbaru", "Surabaya", "Padang", "Jakarta Barat", "Medan", "Bekasi", "Pekanbaru", "Bandung", "Padang", "Jakarta Timur", "Surabaya", "Medan", "Dumai", "Jakarta Pusat"];
const UNITS = ["Xpander", "Pajero Sport", "Xforce", "Triton", "Xpander Cross", "L300", "Destinator", "Belum tahu"];
const SOURCES: LeadSource[] = ["Meta Ads", "Meta Ads", "Meta Ads", "Google Ads", "Google Ads", "Google Organic", "WhatsApp Organic", "Unknown"];
const CAMPAIGNS: Record<string, string> = { "Meta Ads": "CTWA - Promo Akhir Tahun", "Google Ads": "Search - Mitsubishi Medan Jakarta" };

const H = 3600_000;

export function seedData(now = Date.now()) {
  const agents = seedAgents();
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
    const qualifying = i % 9 === 4; // sebagian masih dalam kualifikasi AI
    const id = `L-${String(1001 + i)}`;
    const phone = `+62 81${(2 + (i % 7))} ${String(1000 + i * 37).slice(0, 4)} ${String(5000 + i * 91).slice(0, 4)}`;

    const lead: Lead = {
      id, phone, source, campaign: CAMPAIGNS[source],
      name: qualifying ? (i % 2 ? name : undefined) : name,
      city: qualifying ? undefined : city,
      unit: qualifying ? undefined : unit,
      status: "COLD", inQueue: false, aiActive: qualifying,
      createdAt, lastCustomerMsgAt: createdAt,
    };

    msg({ leadId: id, from: "customer", text: source === "Meta Ads" ? "Halo, saya mau tanya promo yang ada di iklan" : "Halo, mau tanya-tanya mobil Mitsubishi", at: createdAt });
    msg({ leadId: id, from: "ai", text: "Halo, terima kasih sudah menghubungi Mitsubishi DIPO! Saya asisten virtual yang akan membantu meneruskan kebutuhan Anda ke tim sales. Boleh saya tahu dengan Bapak/Ibu siapa?", at: createdAt + 20_000 });
    if (lead.name) {
      msg({ leadId: id, from: "customer", text: `Saya ${name}`, at: createdAt + 2 * 60_000 });
      msg({ leadId: id, from: "ai", text: `Terima kasih, ${name}. Saat ini berdomisili di kota/kabupaten mana?`, at: createdAt + 2 * 60_000 + 15_000 });
    }

    if (!qualifying) {
      msg({ leadId: id, from: "customer", text: `Di ${city}, minat ${unit === "Belum tahu" ? "masih bingung pilih unit, belum tahu" : unit}`, at: createdAt + 4 * 60_000 });
      msg({ leadId: id, from: "ai", text: `Terima kasih ${name}! Data Anda sudah kami terima (domisili: ${city}, unit: ${unit}). Tim sales kami akan segera melanjutkan percakapan ini. 🙏`, at: createdAt + 4 * 60_000 + 15_000 });
      lead.lastCustomerMsgAt = createdAt + 4 * 60_000;
      msg({ leadId: id, from: "system", text: "AI handover — balasan otomatis dihentikan.", at: createdAt + 4 * 60_000 + 16_000 });

      const ag = agents.find((a) => a.cities.includes(city));
      const load = ag ? leads.filter((l) => l.agentId === ag.id).length : 0;
      if (ag && ag.available && load < ag.capacity) {
        lead.status = "WARM"; lead.agentId = ag.id; lead.assignedAt = createdAt + 5 * 60_000;
        audit.push({ id: `a${audit.length + 1}`, at: lead.assignedAt, actor: "Sistem (auto-routing)", action: "Auto assignment", target: id, detail: `Ditugaskan ke ${ag.name} — match "${city}"` });
        if (i % 2 === 0) {
          msg({ leadId: id, from: "agent", author: ag.name, text: `Halo ${name}, saya ${ag.name.split(" ")[0]} dari Mitsubishi DIPO ${ag.territory}. Untuk ${unit} sedang ada promo menarik, mau saya kirimkan price list-nya?`, at: createdAt + 30 * 60_000, status: "read" });
          if (i % 4 === 0) {
            msg({ leadId: id, from: "customer", text: "Boleh kak, sekalian simulasi kredit ya", at: createdAt + 45 * 60_000 });
            lead.lastCustomerMsgAt = createdAt + 45 * 60_000;
          }
        }
      } else {
        lead.inQueue = true;
        lead.queueReason = !ag ? `Domisili "${city}" tidak ada di mapping wilayah` : !ag.available ? `${ag.name} sedang tidak tersedia` : `Kapasitas ${ag.name} penuh`;
        audit.push({ id: `a${audit.length + 1}`, at: createdAt + 5 * 60_000, actor: "Sistem (auto-routing)", action: "Masuk Admin Queue", target: id, detail: lead.queueReason });
      }
    }
    leads.push(lead);
  });

  audit.push({ id: `a${audit.length + 1}`, at: now - 200 * H, actor: "Super Admin", action: "Ubah territory mapping", target: "Agent Jakarta", detail: "Menambahkan 5 kota administrasi Jakarta" });
  audit.push({ id: `a${audit.length + 1}`, at: now - 30 * H, actor: "Admin Pusat", action: "Ubah availability", target: "Sinta (Surabaya)", detail: "Tersedia → Tidak tersedia (cuti)" });
  audit.sort((a, b) => b.at - a.at);

  return { agents, leads, messages, audit };
}
