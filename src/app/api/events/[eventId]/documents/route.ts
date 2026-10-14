import { boundedFormData } from "@/server/http/form-data";
import { requireSameOrigin } from "@/server/auth/origin";
import { requireUser } from "@/server/auth/session";
import { addDocument } from "@/server/events/documents";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    if (Number(request.headers.get("content-length") || 0) > 11 * 1024 * 1024)
      throw new Error("Choose a PDF up to 10 MB.");
    const file = (await boundedFormData(request, 11 * 1024 * 1024)).get(
      "document",
    );
    if (!(file instanceof File)) throw new Error("Choose a PDF.");
    return Response.json(
      await addDocument(user.id, (await params).eventId, file),
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Could not upload PDF.",
      },
      { status: 400 },
    );
  }
}
