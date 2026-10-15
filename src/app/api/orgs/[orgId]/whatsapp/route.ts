import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { integrationAction, integrationStatus } from "@/server/whatsapp/integration";
import { WaError } from "@raunak/wa-contracts";
import { ZodError } from "zod";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status = message === "Authentication required." ? 401 : message === "Access denied." ? 403 : error instanceof WaError && error.code === "RATE_LIMITED" ? 429 : 400;
  return Response.json({ error: error instanceof WaError ? error.code : error instanceof ZodError ? "Check the phone number and selected options." : status === 401 || status === 403 ? message : "Could not update WhatsApp. Check the gateway connection and try again.", ...(error instanceof WaError ? { errorCode: error.code } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try { const user = await requireUser(); return Response.json(await integrationStatus(user.id, (await params).orgId), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return failure(error); }
}
export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try { requireSameOrigin(request); const user = await requireUser(); return Response.json(await integrationAction(user.id, (await params).orgId, await request.json()), { headers: { "Cache-Control": "no-store" } }); } catch (error) { return failure(error); }
}
