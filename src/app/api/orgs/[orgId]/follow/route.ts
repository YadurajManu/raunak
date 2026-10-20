import { currentUser, requireUser } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/origin";
import { db } from "@/server/db/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const user = await currentUser();

  const [count, follower] = await Promise.all([
    db.organizationFollower.count({ where: { orgId } }),
    user
      ? db.organizationFollower.findUnique({
          where: { userId_orgId: { userId: user.id, orgId } },
        })
      : null,
  ]);

  return Response.json({
    count,
    following: Boolean(follower),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { orgId } = await params;

    const existing = await db.organizationFollower.findUnique({
      where: { userId_orgId: { userId: user.id, orgId } },
    });

    if (existing) {
      await db.organizationFollower.delete({
        where: { id: existing.id },
      });
    } else {
      await db.organizationFollower.create({
        data: {
          userId: user.id,
          orgId,
        },
      });
    }

    const count = await db.organizationFollower.count({ where: { orgId } });

    return Response.json({
      following: !existing,
      count,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update follow status." },
      { status: 400 },
    );
  }
}
