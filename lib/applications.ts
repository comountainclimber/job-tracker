import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { applications, db } from "../db";
import type { ApplicationRow } from "../db/schema";
import { isNeedsAttention } from "./attention";
import {
  PIPELINE_STAGES,
  type Application,
  type ApplicationSyncRow,
  type ListApplicationsQuery,
  type Stage,
  type UpdateInput,
  type UpsertInput,
  type UpsertResult,
} from "./types";

const UPSERT_BATCH_LIMIT = 50;

function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    stage: row.stage,
    jobUrl: row.jobUrl,
    source: row.source,
    location: row.location,
    resumeLabel: row.resumeLabel,
    appliedAt: row.appliedAt,
    applyBy: row.applyBy,
    nextAction: row.nextAction,
    nextActionAt: row.nextActionAt,
    notes: row.notes,
    archived: row.archived,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    notionPageId: row.notionPageId ?? null,
  };
}

function toSyncRow(row: ApplicationRow): ApplicationSyncRow {
  return {
    ...toApplication(row),
    notionSyncedAt: row.notionSyncedAt ?? null,
    notionLastEditedTime: row.notionLastEditedTime ?? null,
  };
}

function emitLocalChange(type: "upsert" | "delete", application: Application) {
  void import("./notion/sync")
    .then((mod) =>
      type === "delete"
        ? mod.scheduleNotionDelete(application)
        : mod.scheduleNotionPush(application),
    )
    .catch((err: unknown) => {
      console.error("[notion]", err);
    });
}

function trimRequired(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }
  return trimmed;
}

function normalizeJobUrl(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function searchCondition(q?: string) {
  const term = q?.trim();
  if (!term) return undefined;
  const pattern = `%${term.toLowerCase()}%`;
  return or(
    sql`lower(${applications.company}) like ${pattern}`,
    sql`lower(${applications.role}) like ${pattern}`,
    sql`lower(${applications.jobUrl}) like ${pattern}`,
    sql`lower(${applications.notes}) like ${pattern}`,
  );
}

function findDuplicates(
  company: string,
  role: string,
  exceptId: string,
): Application[] {
  return db
    .select()
    .from(applications)
    .where(
      and(
        sql`lower(${applications.company}) = ${company.toLowerCase()}`,
        sql`lower(${applications.role}) = ${role.toLowerCase()}`,
        ne(applications.id, exceptId),
      ),
    )
    .all()
    .map(toApplication);
}

function requireApplication(id: string): Application {
  const found = getApplication(id);
  if (!found) {
    throw new Error(`Application ${id} not found`);
  }
  return found;
}

/**
 * Lists applications.
 * When `archived` is omitted or undefined, only non-archived rows are returned.
 * Pass `archived: true` for archived-only rows, or call twice and concatenate to show all.
 */
export function listApplications(
  query?: ListApplicationsQuery,
): Application[] {
  const archived = query?.archived ?? false;
  const rows = db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.archived, archived),
        query?.stage ? eq(applications.stage, query.stage) : undefined,
        searchCondition(query?.q),
      ),
    )
    .orderBy(desc(applications.updatedAt))
    .all();

  const mapped = rows.map(toApplication);
  if (query?.needsAttention) {
    return mapped.filter((app) => isNeedsAttention(app));
  }
  return mapped;
}

export function getApplication(id: string): Application | null {
  const row = db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .get();
  return row ? toApplication(row) : null;
}

export function getApplicationSyncRow(id: string): ApplicationSyncRow | null {
  const row = db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .get();
  return row ? toSyncRow(row) : null;
}

export function listApplicationSyncRows(): ApplicationSyncRow[] {
  return db.select().from(applications).all().map(toSyncRow);
}

export function getApplicationByNotionPageId(
  pageId: string,
): ApplicationSyncRow | null {
  const row = db
    .select()
    .from(applications)
    .where(eq(applications.notionPageId, pageId))
    .get();
  return row ? toSyncRow(row) : null;
}

export function getApplicationByJobUrl(jobUrl: string): ApplicationSyncRow | null {
  const row = db
    .select()
    .from(applications)
    .where(eq(applications.jobUrl, jobUrl))
    .get();
  return row ? toSyncRow(row) : null;
}

export function findApplicationsByCompanyRole(
  company: string,
  role: string,
): ApplicationSyncRow[] {
  return db
    .select()
    .from(applications)
    .where(
      and(
        sql`lower(${applications.company}) = ${company.toLowerCase()}`,
        sql`lower(${applications.role}) = ${role.toLowerCase()}`,
      ),
    )
    .all()
    .map(toSyncRow);
}

export function searchApplications(q: string): Application[] {
  const condition = searchCondition(q);
  if (!condition) return [];
  return db
    .select()
    .from(applications)
    .where(condition)
    .orderBy(desc(applications.updatedAt))
    .all()
    .map(toApplication);
}

export function upsertApplication(input: UpsertInput): UpsertResult {
  const now = Date.now();
  const company = trimRequired(input.company, "company");
  const role = trimRequired(input.role, "role");
  const jobUrl = normalizeJobUrl(input.jobUrl) ?? null;

  if (jobUrl) {
    const existing = db
      .select()
      .from(applications)
      .where(eq(applications.jobUrl, jobUrl))
      .get();
    if (existing) {
      const row = db
        .update(applications)
        .set({
          company,
          role,
          ...(input.stage !== undefined ? { stage: input.stage } : {}),
          jobUrl,
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.resumeLabel !== undefined
            ? { resumeLabel: input.resumeLabel }
            : {}),
          ...(input.appliedAt !== undefined ? { appliedAt: input.appliedAt } : {}),
          ...(input.applyBy !== undefined ? { applyBy: input.applyBy } : {}),
          ...(input.nextAction !== undefined
            ? { nextAction: input.nextAction }
            : {}),
          ...(input.nextActionAt !== undefined
            ? { nextActionAt: input.nextActionAt }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.archived !== undefined ? { archived: input.archived } : {}),
          updatedAt: now,
        })
        .where(eq(applications.id, existing.id))
        .returning()
        .get();
      const application = toApplication(row!);
      emitLocalChange("upsert", application);
      return {
        application,
        created: false,
        duplicates: findDuplicates(company, role, application.id),
      };
    }
  }

  const row = db
    .insert(applications)
    .values({
      id: crypto.randomUUID(),
      company,
      role,
      stage: input.stage ?? "wishlist",
      jobUrl,
      source: input.source ?? null,
      location: input.location ?? null,
      resumeLabel: input.resumeLabel ?? null,
      appliedAt: input.appliedAt ?? null,
      applyBy: input.applyBy ?? null,
      nextAction: input.nextAction ?? null,
      nextActionAt: input.nextActionAt ?? null,
      notes: input.notes ?? null,
      archived: input.archived ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  const application = toApplication(row!);
  emitLocalChange("upsert", application);
  return {
    application,
    created: true,
    duplicates: findDuplicates(company, role, application.id),
  };
}

export function upsertApplications(inputs: UpsertInput[]): UpsertResult[] {
  if (inputs.length > UPSERT_BATCH_LIMIT) {
    throw new Error(
      `upsertApplications accepts at most ${UPSERT_BATCH_LIMIT} items`,
    );
  }
  return inputs.map((input) => upsertApplication(input));
}

export function updateApplication(id: string, input: UpdateInput): Application {
  requireApplication(id);
  const now = Date.now();
  const company =
    input.company !== undefined
      ? trimRequired(input.company, "company")
      : undefined;
  const role =
    input.role !== undefined ? trimRequired(input.role, "role") : undefined;
  const jobUrl = normalizeJobUrl(input.jobUrl);

  const row = db
    .update(applications)
    .set({
      ...(company !== undefined ? { company } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(jobUrl !== undefined ? { jobUrl } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.resumeLabel !== undefined
        ? { resumeLabel: input.resumeLabel }
        : {}),
      ...(input.appliedAt !== undefined ? { appliedAt: input.appliedAt } : {}),
      ...(input.applyBy !== undefined ? { applyBy: input.applyBy } : {}),
      ...(input.nextAction !== undefined
        ? { nextAction: input.nextAction }
        : {}),
      ...(input.nextActionAt !== undefined
        ? { nextActionAt: input.nextActionAt }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      updatedAt: now,
    })
    .where(eq(applications.id, id))
    .returning()
    .get();
  const application = toApplication(row!);
  emitLocalChange("upsert", application);
  return application;
}

export function moveApplication(id: string, stage: Stage): Application {
  const existing = requireApplication(id);
  const now = Date.now();
  const archived =
    stage === "rejected" || stage === "withdrawn"
      ? true
      : PIPELINE_STAGES.includes(stage)
        ? false
        : existing.archived;
  const appliedAt =
    stage === "applied" && existing.appliedAt == null
      ? now
      : existing.appliedAt;

  const row = db
    .update(applications)
    .set({
      stage,
      archived,
      appliedAt,
      updatedAt: now,
    })
    .where(eq(applications.id, id))
    .returning()
    .get();
  const application = toApplication(row!);
  emitLocalChange("upsert", application);
  return application;
}

export function archiveApplication(
  id: string,
  archived = true,
): Application {
  requireApplication(id);
  const row = db
    .update(applications)
    .set({
      archived,
      updatedAt: Date.now(),
    })
    .where(eq(applications.id, id))
    .returning()
    .get();
  const application = toApplication(row!);
  emitLocalChange("upsert", application);
  return application;
}

export function deleteApplication(id: string): void {
  const existing = getApplication(id);
  db.delete(applications).where(eq(applications.id, id)).run();
  if (existing) {
    emitLocalChange("delete", existing);
  }
}

export function applyRemoteUpdate(
  id: string,
  input: UpdateInput & { archived?: boolean },
  meta: { notionPageId: string; notionLastEditedTime: string },
): Application {
  requireApplication(id);
  const now = Date.now();
  const company =
    input.company !== undefined
      ? trimRequired(input.company, "company")
      : undefined;
  const role =
    input.role !== undefined ? trimRequired(input.role, "role") : undefined;
  const jobUrl = normalizeJobUrl(input.jobUrl);

  const row = db
    .update(applications)
    .set({
      ...(company !== undefined ? { company } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(jobUrl !== undefined ? { jobUrl } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.resumeLabel !== undefined
        ? { resumeLabel: input.resumeLabel }
        : {}),
      ...(input.appliedAt !== undefined ? { appliedAt: input.appliedAt } : {}),
      ...(input.applyBy !== undefined ? { applyBy: input.applyBy } : {}),
      ...(input.nextAction !== undefined
        ? { nextAction: input.nextAction }
        : {}),
      ...(input.nextActionAt !== undefined
        ? { nextActionAt: input.nextActionAt }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      notionPageId: meta.notionPageId,
      notionLastEditedTime: meta.notionLastEditedTime,
      notionSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(applications.id, id))
    .returning()
    .get();
  return toApplication(row!);
}

export function insertApplicationFromRemote(input: {
  id?: string;
  company: string;
  role: string;
  stage: Stage;
  source: Application["source"];
  jobUrl: string | null;
  location: string | null;
  resumeLabel: string | null;
  appliedAt: number | null;
  applyBy: number | null;
  nextAction: string | null;
  nextActionAt: number | null;
  notes: string | null;
  archived: boolean;
  notionPageId: string;
  notionLastEditedTime: string;
}): Application {
  const now = Date.now();
  const id = input.id?.trim() || crypto.randomUUID();
  const row = db
    .insert(applications)
    .values({
      id,
      company: trimRequired(input.company, "company"),
      role: trimRequired(input.role, "role"),
      stage: input.stage,
      jobUrl: normalizeJobUrl(input.jobUrl) ?? null,
      source: input.source,
      location: input.location,
      resumeLabel: input.resumeLabel,
      appliedAt: input.appliedAt,
      applyBy: input.applyBy,
      nextAction: input.nextAction,
      nextActionAt: input.nextActionAt,
      notes: input.notes,
      archived: input.archived,
      createdAt: now,
      updatedAt: now,
      notionPageId: input.notionPageId,
      notionLastEditedTime: input.notionLastEditedTime,
      notionSyncedAt: now,
    })
    .returning()
    .get();
  return toApplication(row!);
}

export function setNotionLink(
  id: string,
  meta: {
    notionPageId: string;
    notionLastEditedTime: string;
    notionSyncedAt: number;
  },
): void {
  db.update(applications)
    .set({
      notionPageId: meta.notionPageId,
      notionLastEditedTime: meta.notionLastEditedTime,
      notionSyncedAt: meta.notionSyncedAt,
    })
    .where(eq(applications.id, id))
    .run();
}

export function markNotionPageGone(id: string): Application {
  const now = Date.now();
  const row = db
    .update(applications)
    .set({
      archived: true,
      updatedAt: now,
      notionSyncedAt: now,
    })
    .where(eq(applications.id, id))
    .returning()
    .get();
  return toApplication(row!);
}

export function listNeedsAttention(): Application[] {
  return listApplications({ archived: false }).filter((app) =>
    isNeedsAttention(app),
  );
}
