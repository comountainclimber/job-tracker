import {
  deleteApplication,
  getApplication,
  updateApplication,
} from "@/lib/applications";
import { SOURCES, STAGES } from "@/lib/types";
import * as z from "zod";

const updateInputSchema = z.object({
  company: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  stage: z.enum(STAGES).optional(),
  jobUrl: z.string().nullable().optional(),
  source: z.enum(SOURCES).nullable().optional(),
  location: z.string().nullable().optional(),
  resumeLabel: z.string().nullable().optional(),
  appliedAt: z.number().nullable().optional(),
  applyBy: z.number().nullable().optional(),
  nextAction: z.string().nullable().optional(),
  nextActionAt: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  archived: z.boolean().optional(),
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

type IdContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    const application = getApplication(id);
    if (!application) {
      return Response.json({ error: `Application not found: ${id}` }, { status: 404 });
    }
    return Response.json(application);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function PATCH(request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = updateInputSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }
    return Response.json(updateApplication(id, parsed.data));
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, context: IdContext) {
  try {
    const { id } = await context.params;
    deleteApplication(id);
    return Response.json({ ok: true, id });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
