import { messagePreviewResponse } from "@/server/notifications/preview";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  return messagePreviewResponse((await params).eventId);
}
