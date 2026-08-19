import { moveApplication } from "@/lib/applications";
import { STAGES } from "@/lib/types";
import * as z from "zod";

const moveSchema = z.object({
  stage: z.enum(STAGES),
});

function validationResponse(error: z.ZodError) {
  return Response.json(
    { error: "Validation failed", issues: error.issues },
    { status: 400 },
  );
}

function domainErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = /not found/i.test(message) ? 404 : 500;
  return Response.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = moveSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }
    return Response.json(moveApplication(id, parsed.data.stage));
  } catch (err) {
    return domainErrorResponse(err);
  }
}
