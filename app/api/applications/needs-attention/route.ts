import { listNeedsAttention } from "@/lib/applications";

function domainErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = /not found/i.test(message) ? 404 : 500;
  return Response.json({ error: message }, { status });
}

export async function GET() {
  try {
    return Response.json(listNeedsAttention());
  } catch (err) {
    return domainErrorResponse(err);
  }
}
