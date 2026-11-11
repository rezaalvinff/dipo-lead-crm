import { api } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { getState } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

export const GET = api(async () => getState(await requireUser()));
