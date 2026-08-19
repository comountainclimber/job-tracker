import { upsertApplications } from "@/lib/applications";
import { SOURCES, STAGES } from "@/lib/types";
import * as z from "zod";

const upsertInputSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
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

const bulkSchema = z.object({
  items: z.array(upsertInputSchema).min(1).max(50),
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

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }
    return Response.json(upsertApplications(parsed.data.items));
  } catch (err) {
    return domainErrorResponse(err);
  }
}
