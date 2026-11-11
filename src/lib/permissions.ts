import type { Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin Pusat / Supervisor",
  sales: "Sales Agent",
};

/** Diturunkan dari sheet "Role & Hak Akses". */
export const can = {
  viewAllLeads: (r: Role) => r !== "sales",
  manageQueue: (r: Role) => r !== "sales",
  assign: (r: Role) => r !== "sales",
  manageUsers: (r: Role) => r !== "sales",
  manageTerritory: (r: Role) => r !== "sales",
  manageAvailability: (r: Role) => r !== "sales",
  viewGlobalDashboard: (r: Role) => r !== "sales",
  viewReports: (_r: Role) => true,
  manageIntegrations: (r: Role) => r === "super_admin",
  viewAudit: (r: Role) => r !== "sales",
  useSimulator: (r: Role) => r !== "sales",
};
