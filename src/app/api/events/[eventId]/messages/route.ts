import { messageActionResponse } from "@/server/notifications/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  return messageActionResponse(request, (await params).eventId);
}
