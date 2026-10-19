import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { createCheckout } from "@/server/checkout/service";
import { checkoutSnapshot, checkoutError } from "@/server/checkout/response";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const order = await createCheckout(user, await request.json());
    return Response.json(await checkoutSnapshot(order.id, user.id), {
      status: 201,
    });
  } catch (error) {
    return checkoutError(error);
  }
}
