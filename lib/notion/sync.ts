import {
  APIErrorCode,
  isFullPage,
  isNotionClientError,
} from "@notionhq/client";
import type { CreatePageParameters, PageObjectResponse } from "@notionhq/client";
import {
  applyRemoteUpdate,
  findApplicationsByCompanyRole,
  getApplication,
  getApplicationByJobUrl,
  getApplicationByNotionPageId,
  getApplicationSyncRow,
  insertApplicationFromRemote,
  listApplicationSyncRows,
  markNotionPageGone,
  setNotionLink,
} from "../applications";
import { deleteSetting, getSetting, setSetting } from "../settings";
import type { Application, ApplicationSyncRow, NotionSyncStatus } from "../types";
import {
  createNotionContext,
  formatNotionError,
  getNotionContext,
  resetNotionClient,
  type NotionContext,
} from "./client";
import {
  getNotionCredentials,
  isNotionEnabled,
  SETTING_LAST_SYNC_ERROR,
  SETTING_LAST_SYNCED_AT,
} from "./config";
import { fromNotionPage, toNotionProperties, type NotionPageLike } from "./map";
import { decideMerge, isLocalDirty } from "./merge";
import { ensureSchema } from "./schema";

const MIN_GAP_MS = 350;

let lastNotionCallAt = 0;
let pushChain: Promise<void> = Promise.resolve();
let reconcileInFlight: Promise<NotionSyncStatus> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle() {
  const wait = MIN_GAP_MS - (Date.now() - lastNotionCallAt);
  if (wait > 0) {
    await sleep(wait);
  }
  lastNotionCallAt = Date.now();
}

function asPageLike(page: PageObjectResponse): NotionPageLike {
  return {
    id: page.id,
    last_edited_time: page.last_edited_time,
    in_trash: page.in_trash,
    properties: page.properties as NotionPageLike["properties"],
  };
}

function mappedToUpdate(mapped: ReturnType<typeof fromNotionPage>) {
  return {
    company: mapped.company,
    role: mapped.role,
    stage: mapped.stage,
    source: mapped.source,
    jobUrl: mapped.jobUrl,
    location: mapped.location,
    resumeLabel: mapped.resumeLabel,
    appliedAt: mapped.appliedAt,
    applyBy: mapped.applyBy,
    nextAction: mapped.nextAction,
    nextActionAt: mapped.nextActionAt,
    notes: mapped.notes,
    archived: mapped.archived,
  };
}

function matchLocal(
  mapped: ReturnType<typeof fromNotionPage>,
  pageId: string,
): ApplicationSyncRow | null {
  if (mapped.trackerId) {
    const byTracker = getApplicationSyncRow(mapped.trackerId);
    if (byTracker) return byTracker;
  }
  const byPage = getApplicationByNotionPageId(pageId);
  if (byPage) return byPage;
  if (mapped.jobUrl) {
    const byUrl = getApplicationByJobUrl(mapped.jobUrl);
    if (byUrl) return byUrl;
  }
  const byCompanyRole = findApplicationsByCompanyRole(mapped.company, mapped.role);
  if (byCompanyRole.length === 1) return byCompanyRole[0]!;
  return null;
}

async function writePage(
  context: NotionContext,
  application: Application,
): Promise<{ pageId: string; lastEditedTime: string }> {
  const properties = toNotionProperties(
    application,
    context.titlePropertyName,
  ) as CreatePageParameters["properties"];

  await throttle();
  if (application.notionPageId) {
    try {
      const updated = await context.client.pages.update({
        page_id: application.notionPageId,
        properties,
        in_trash: false,
      });
      return {
        pageId: updated.id,
        lastEditedTime: isFullPage(updated)
          ? updated.last_edited_time
          : new Date().toISOString(),
      };
    } catch (err) {
      const missing =
        isNotionClientError(err) && err.code === APIErrorCode.ObjectNotFound;
      if (!missing) throw err;
    }
  }

  await throttle();
  const created = await context.client.pages.create({
    parent: { type: "data_source_id", data_source_id: context.dataSourceId },
    properties,
  });
  return {
    pageId: created.id,
    lastEditedTime: isFullPage(created)
      ? created.last_edited_time
      : new Date().toISOString(),
  };
}

export async function pushApplication(application: Application): Promise<void> {
  if (!isNotionEnabled()) return;
  const latest = getApplication(application.id) ?? application;
  const context = await getNotionContext();
  const result = await writePage(context, latest);
  setNotionLink(latest.id, {
    notionPageId: result.pageId,
    notionLastEditedTime: result.lastEditedTime,
    notionSyncedAt: Date.now(),
  });
}

async function trashPage(pageId: string): Promise<void> {
  const context = await getNotionContext();
  await throttle();
  try {
    await context.client.pages.update({
      page_id: pageId,
      in_trash: true,
    });
  } catch (err) {
    const missing =
      isNotionClientError(err) && err.code === APIErrorCode.ObjectNotFound;
    if (!missing) throw err;
  }
}

export function scheduleNotionPush(application: Application): void {
  if (!isNotionEnabled()) return;
  pushChain = pushChain
    .then(() => pushApplication(application))
    .catch((err: unknown) => {
      console.error("[notion]", formatNotionError(err));
    });
}

export function scheduleNotionDelete(application: Application): void {
  if (!isNotionEnabled() || !application.notionPageId) return;
  const pageId = application.notionPageId;
  pushChain = pushChain
    .then(() => trashPage(pageId))
    .catch((err: unknown) => {
      console.error("[notion]", formatNotionError(err));
    });
}

async function fetchRemotePages(context: NotionContext): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;
  do {
    await throttle();
    const response = await context.client.dataSources.query({
      data_source_id: context.dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const item of response.results) {
      if (isFullPage(item) && !item.in_trash) {
        pages.push(item);
      }
    }
    cursor =
      response.has_more && response.next_cursor
        ? response.next_cursor
        : undefined;
  } while (cursor);
  return pages;
}

function recordSyncResult(error: string | null): NotionSyncStatus {
  const credentials = getNotionCredentials();
  const lastSyncedAt = Date.now();
  setSetting(SETTING_LAST_SYNCED_AT, String(lastSyncedAt));
  if (error) {
    setSetting(SETTING_LAST_SYNC_ERROR, error);
  } else {
    deleteSetting(SETTING_LAST_SYNC_ERROR);
  }
  return {
    enabled: Boolean(credentials),
    source: credentials?.source ?? null,
    lastSyncedAt,
    error,
  };
}

export function getNotionSyncStatus(): NotionSyncStatus {
  const credentials = getNotionCredentials();
  const lastSyncedAtRaw = getSetting(SETTING_LAST_SYNCED_AT);
  const lastSyncedAt = lastSyncedAtRaw ? Number(lastSyncedAtRaw) : null;
  return {
    enabled: Boolean(credentials),
    source: credentials?.source ?? null,
    lastSyncedAt:
      lastSyncedAt != null && Number.isFinite(lastSyncedAt) ? lastSyncedAt : null,
    error: getSetting(SETTING_LAST_SYNC_ERROR),
  };
}

async function runReconcile(): Promise<NotionSyncStatus> {
  if (!isNotionEnabled()) {
    return getNotionSyncStatus();
  }

  try {
    const context = await getNotionContext();
    await ensureSchema(context);
    const refreshed = await getNotionContext();
    const remotes = await fetchRemotePages(refreshed);
    const locals = listApplicationSyncRows();
    const matched = new Set<string>();

    for (const page of remotes) {
      const mapped = fromNotionPage(asPageLike(page), refreshed.titlePropertyName);
      const local = matchLocal(mapped, page.id);
      const meta = {
        notionPageId: page.id,
        notionLastEditedTime: page.last_edited_time,
      };

      if (!local) {
        const created = insertApplicationFromRemote({
          id: mapped.trackerId ?? undefined,
          ...mappedToUpdate(mapped),
          notionPageId: page.id,
          notionLastEditedTime: page.last_edited_time,
        });
        matched.add(created.id);
        await pushApplication(getApplication(created.id) ?? created);
        continue;
      }

      matched.add(local.id);
      const decision = decideMerge({
        local,
        remoteLastEditedTime: page.last_edited_time,
      });
      if (decision === "pull") {
        applyRemoteUpdate(local.id, mappedToUpdate(mapped), meta);
      } else if (decision === "push") {
        await pushApplication({ ...local, notionPageId: page.id });
      } else if (local.notionPageId !== page.id) {
        setNotionLink(local.id, {
          notionPageId: page.id,
          notionLastEditedTime: page.last_edited_time,
          notionSyncedAt: local.notionSyncedAt ?? Date.now(),
        });
      }
    }

    for (const local of locals) {
      if (matched.has(local.id)) continue;
      if (local.notionPageId) {
        if (isLocalDirty(local)) {
          await pushApplication({ ...local, notionPageId: null });
        } else {
          markNotionPageGone(local.id);
        }
      } else {
        await pushApplication(local);
      }
    }

    return recordSyncResult(null);
  } catch (err) {
    const message = formatNotionError(err);
    console.error("[notion]", message);
    return recordSyncResult(message);
  }
}

export function reconcileAll(): Promise<NotionSyncStatus> {
  if (reconcileInFlight) return reconcileInFlight;
  reconcileInFlight = runReconcile().finally(() => {
    reconcileInFlight = null;
  });
  return reconcileInFlight;
}

export async function connectNotion(token: string, databaseId: string) {
  const preview = await createNotionContext(token, databaseId);
  await ensureSchema(preview);
  resetNotionClient();
}

export { resetNotionClient };
