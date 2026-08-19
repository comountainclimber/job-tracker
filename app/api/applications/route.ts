import {
  listApplications,
  upsertApplication,
} from "@/lib/applications";
import { SOURCES, STAGES } from "@/lib/types";
import * as z from "zod";

const boolQuery = z.enum(["true", "false"]).transform((value) => value === "true");

const listQuerySchema = z.object({
  q: z.string().min(1).optional(),
  stage: z.enum(STAGES).optional(),
  archived: boolQuery.optional(),
  needsAttention: boolQuery.optional(),
});

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

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      q: searchParams.get("q") || undefined,
      stage: searchParams.get("stage") || undefined,
      archived: searchParams.get("archived") || undefined,
      needsAttention: searchParams.get("needsAttention") || undefined,
    });
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }
    return Response.json(listApplications(parsed.data));
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = upsertInputSchema.safeParse(body);
    if (!parsed.success) {
      return validationResponse(parsed.error);
    }
    const result = upsertApplication(parsed.data);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
