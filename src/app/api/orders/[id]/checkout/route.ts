import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { checkoutSnapshot, checkoutError } from "@/server/checkout/response";
import { reconcileOrder } from "@/server/checkout/service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!(await checkoutSnapshot(id, user.id)))
      return Response.json({ error: "Booking not found." }, { status: 404 });
    await reconcileOrder(id);
    return Response.json(await checkoutSnapshot(id, user.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return checkoutError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireSameOrigin(request);
    const result = await GET(request, context);
    if (!result.ok) return result;
    const snapshot = await result.json();
    // A live Cashfree session can still charge: keep its hold until expiry or confirmation.
    if (snapshot.status === "PENDING")
      return Response.json(
        {
          error:
            "Your payment session is still active. You can return and retry until the reservation expires.",
        },
        { status: 409 },
      );
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return checkoutError(error);
  }
}
