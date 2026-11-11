import type { Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", agent: "Agent" };

export const ROLE_ACCESS: Record<Role, string[]> = {
  admin: ["Semua menu", "Lihat & kelola semua leads", "Assign / reassign agent", "Kelola agent & wilayah", "Kelola knowledge chatbot", "Laporan, simulator, audit log"],
  agent: ["Inbox (hanya leads miliknya)", "Balas pesan pelanggan", "Lihat informasi leads miliknya"],
};

export const isAdmin = (r?: Role) => r === "admin";
