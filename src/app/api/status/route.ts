import { connection } from "next/server";
import { getServerConfig } from "@/lib/config/env";
import { configuredProviders } from "@/lib/research/providers";
import { NO_STORE } from "@/lib/server/http";


/** Public, minimal capability flags so the UI can be honest about what is switched on. */
export async function GET(): Promise<Response> {
  await connection(); // evaluate per request, never at build time
  const p = configuredProviders();
  return Response.json({ aiEnabled: getServerConfig().AI_INSPECTIONS_ENABLED && p.providers.length > 0 }, { headers: NO_STORE });
}
