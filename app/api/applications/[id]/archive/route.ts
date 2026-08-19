import { archiveApplication } from "@/lib/applications";
import * as z from "zod";

const archiveSchema = z.object({
  archived: z.boolean().optional().default(true),
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
    const text = await request.text();
    let body: unknown = {};
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }
    const parsed = archiveSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }
    return Response.json(archiveApplication(id, parsed.data.archived));
  } catch (err) {
    return domainErrorResponse(err);
  }
}
