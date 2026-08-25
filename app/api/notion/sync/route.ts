import { isNotionEnabled } from "@/lib/notion/config";
import { getNotionSyncStatus, reconcileAll } from "@/lib/notion/sync";

export async function GET() {
  return Response.json(getNotionSyncStatus());
}

export async function POST() {
  if (!isNotionEnabled()) {
    return Response.json(getNotionSyncStatus(), { status: 409 });
  }
  const result = await reconcileAll();
  return Response.json(result, { status: result.error ? 502 : 200 });
}