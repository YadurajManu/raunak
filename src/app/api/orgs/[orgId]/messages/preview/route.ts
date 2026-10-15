import { messagePreviewResponse } from "@/server/notifications/preview";
export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return messagePreviewResponse(null, (await params).orgId);
}
