import { db } from "@/server/db/client";
import { WaError } from "@raunak/wa-contracts";
import { whatsapp } from "@/server/providers/whatsapp/provider";
import { BaileysGatewayProvider } from "@/server/providers/whatsapp/gateway";

export async function resolveWhatsApp(orgId: string) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId } });
  if (org.whatsappMode === "OFFICIAL_API")
    return { kind: "official" as const, provider: whatsapp };
  if (
    org.whatsappMode === "DISABLED" ||
    process.env.WA_UNOFFICIAL_ENABLED !== "true"
  )
    throw new WaError("KILL_SWITCH");
  if (!["baileys", "mock"].includes(process.env.WHATSAPP_PROVIDER || ""))
    throw new WaError("KILL_SWITCH");
  const session = await db.whatsAppSession.findFirst({
    where: {
      orgId: org.whatsappMode === "ORG_NUMBER" ? orgId : null,
      label: "default",
    },
  });
  if (session?.status === "PAUSED" || session?.status === "BANNED_SUSPECTED")
    throw new WaError("SESSION_PAUSED");
  if (!session || session.status !== "CONNECTED")
    throw new WaError("SESSION_DISCONNECTED");
  return {
    kind: "gateway" as const,
    sessionId: session.id,
    provider: new BaileysGatewayProvider(),
  };
}
