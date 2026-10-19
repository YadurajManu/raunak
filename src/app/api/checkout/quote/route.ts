import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { quoteCheckout } from "@/server/checkout/quote";
import { checkoutError } from "@/server/checkout/response";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    await requireUser();
    return Response.json(await quoteCheckout(await request.json()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return checkoutError(error);
  }
}
