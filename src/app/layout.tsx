import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "DIPO Lead CRM",
  description: "Prototype AI WhatsApp Lead Management — Mitsubishi DIPO",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body><StoreProvider>{children}</StoreProvider></body>
    </html>
  );
}
