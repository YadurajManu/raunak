import { requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { createCheckout } from "@/server/checkout/service";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    return Response.json(await createCheckout(user, await request.json()), {
      status: 201,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not create order.",
      },
      { status: 400 },
    );
  }
}
