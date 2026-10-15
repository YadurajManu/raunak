import { messageActionResponse } from "@/server/notifications/http";
export async function POST(request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return messageActionResponse(request, null, (await params).orgId);
}
