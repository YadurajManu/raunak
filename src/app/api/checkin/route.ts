import { currentUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { checkIn, searchAttendees } from "@/server/checkin/service";
export async function GET(request: Request) {
  const user = await currentUser(); if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try { const query = new URL(request.url).searchParams; return Response.json(await searchAttendees(user.id, { eventId: query.get("eventId"), q: query.get("q") }), { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "Search unavailable. Check your event access and enter at least two characters." }, { status: 403 }); }
}
export async function POST(request: Request) {
  const user = await currentUser(); if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  try { requireSameOrigin(request); return Response.json(await checkIn(user.id, await request.json())); }
  catch { return Response.json({ error: "Check-in denied. Check your event access and QR code." }, { status: 403 }); }
}
