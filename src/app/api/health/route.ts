import { NextResponse } from "next/server";
import { isLive } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ live: isLive() });
}
