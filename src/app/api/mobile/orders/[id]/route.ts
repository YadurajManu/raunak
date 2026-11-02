import { z } from "zod";
import { currentUser } from "@/server/auth/session";
import { checkoutSnapshot, checkoutError } from "@/server/checkout/response";
import { reconcileOrder } from "@/server/checkout/service";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: "Please sign in to view this booking." },
        { status: 401, headers },
      );
    const id = z.uuid().safeParse((await params).id);
    if (!id.success)
      return Response.json(
        { error: "Booking not found." },
        { status: 404, headers },
      );
    let snapshot = await checkoutSnapshot(id.data, user.id);
    if (!snapshot)
      return Response.json(
        { error: "Booking not found." },
        { status: 404, headers },
      );
    let verificationDelayed = false;
    if (snapshot.status === "PENDING") {
      try {
        await reconcileOrder(id.data);
        snapshot = await checkoutSnapshot(id.data, user.id);
      } catch {
        verificationDelayed = true;
      }
    }
    return Response.json({ ...snapshot, verificationDelayed }, { headers });
  } catch (error) {
    return checkoutError(error);
  }
}
