import type { ApplicationSyncRow } from "../types";

export type MergeDecision = "push" | "pull" | "skip";

export function isLocalDirty(local: Pick<ApplicationSyncRow, "updatedAt" | "notionSyncedAt">) {
  return local.notionSyncedAt == null || local.updatedAt > local.notionSyncedAt;
}

export function isRemoteDirty(
  local: Pick<ApplicationSyncRow, "notionLastEditedTime">,
  remoteLastEditedTime: string,
) {
  return (
    local.notionLastEditedTime == null ||
    remoteLastEditedTime > local.notionLastEditedTime
  );
}

export function decideMerge(input: {
  local: Pick<
    ApplicationSyncRow,
    "updatedAt" | "notionSyncedAt" | "notionLastEditedTime"
  >;
  remoteLastEditedTime: string;
}): MergeDecision {
  const localDirty = isLocalDirty(input.local);
  const remoteDirty = isRemoteDirty(input.local, input.remoteLastEditedTime);

  if (!localDirty && !remoteDirty) return "skip";
  if (localDirty && !remoteDirty) return "push";
  if (!localDirty && remoteDirty) return "pull";

  const remoteTs = Date.parse(input.remoteLastEditedTime);
  if (Number.isNaN(remoteTs) || input.local.updatedAt >= remoteTs) {
    return "push";
  }
  return "pull";
}
