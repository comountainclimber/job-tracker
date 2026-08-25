import { extractDatabaseId } from "@notionhq/client";
import { SOURCES, STAGES, type Application, type Source, type Stage } from "../types";

export const PROP = {
  company: "Company",
  role: "Role",
  stage: "Stage",
  source: "Source",
  jobUrl: "Job URL",
  location: "Location",
  resume: "Resume",
  applied: "Applied",
  applyBy: "Apply by",
  nextAction: "Next action",
  nextActionAt: "Next action at",
  notes: "Notes",
  archived: "Archived",
  trackerId: "Tracker ID",
} as const;

export type MappedNotionApplication = {
  company: string;
  role: string;
  stage: Stage;
  source: Source | null;
  jobUrl: string | null;
  location: string | null;
  resumeLabel: string | null;
  appliedAt: number | null;
  applyBy: number | null;
  nextAction: string | null;
  nextActionAt: number | null;
  notes: string | null;
  archived: boolean;
  trackerId: string | null;
};

type RichTextItem = { plain_text?: string };
type NotionProperty = {
  type?: string;
  title?: RichTextItem[];
  rich_text?: RichTextItem[];
  select?: { name?: string } | null;
  url?: string | null;
  date?: { start?: string | null } | null;
  checkbox?: boolean;
};

export type NotionPageLike = {
  id: string;
  last_edited_time: string;
  in_trash?: boolean;
  properties: Record<string, NotionProperty | undefined>;
};

export function parseNotionDatabaseId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Database ID is required.");
  }
  const id = extractDatabaseId(trimmed);
  if (!id) {
    throw new Error("Could not parse a Notion database ID from that value.");
  }
  return id;
}

export function maskNotionToken(token: string): string {
  if (token.length <= 8) return "••••";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export function notionPageUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}

export function unixMsToIsoDate(ms: number | null): string | null {
  if (ms == null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export function isoDateToUnixMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0,
  );
}

function plainText(items: RichTextItem[] | undefined): string | null {
  if (!items?.length) return null;
  const text = items.map((item) => item.plain_text ?? "").join("");
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

function readTitle(properties: NotionPageLike["properties"], titlePropertyName: string) {
  const prop = properties[titlePropertyName];
  if (prop?.type === "title") return plainText(prop.title);
  for (const value of Object.values(properties)) {
    if (value?.type === "title") return plainText(value.title);
  }
  return null;
}

function readRichText(
  properties: NotionPageLike["properties"],
  name: string,
): string | null {
  const prop = properties[name];
  if (prop?.type !== "rich_text") return null;
  return plainText(prop.rich_text);
}

function readSelect(
  properties: NotionPageLike["properties"],
  name: string,
): string | null {
  const prop = properties[name];
  if (prop?.type !== "select") return null;
  const value = prop.select?.name?.trim();
  return value ? value : null;
}

function readUrl(
  properties: NotionPageLike["properties"],
  name: string,
): string | null {
  const prop = properties[name];
  if (prop?.type !== "url") return null;
  const value = prop.url?.trim();
  return value ? value : null;
}

function readDate(
  properties: NotionPageLike["properties"],
  name: string,
): number | null {
  const prop = properties[name];
  if (prop?.type !== "date") return null;
  return isoDateToUnixMs(prop.date?.start);
}

function readCheckbox(
  properties: NotionPageLike["properties"],
  name: string,
): boolean {
  const prop = properties[name];
  if (prop?.type !== "checkbox") return false;
  return Boolean(prop.checkbox);
}

function asStage(value: string | null): Stage {
  if (value && (STAGES as readonly string[]).includes(value)) {
    return value as Stage;
  }
  return "wishlist";
}

function asSource(value: string | null): Source | null {
  if (value && (SOURCES as readonly string[]).includes(value)) {
    return value as Source;
  }
  return null;
}

export function displayTitle(company: string, role: string): string {
  return `${company} — ${role}`;
}

const RICH_TEXT_LIMIT = 2000;

function chunkRichText(value: string) {
  const chunks: Array<{ type: "text"; text: { content: string } }> = [];
  for (let index = 0; index < value.length; index += RICH_TEXT_LIMIT) {
    chunks.push({
      type: "text",
      text: { content: value.slice(index, index + RICH_TEXT_LIMIT) },
    });
  }
  return chunks;
}

function richTextProperty(value: string | null) {
  if (!value) return { rich_text: [] };
  return { rich_text: chunkRichText(value) };
}

function titleProperty(value: string) {
  return { title: chunkRichText(value) };
}

function selectProperty(value: string | null) {
  if (!value) return { select: null };
  return { select: { name: value } };
}

function urlProperty(value: string | null) {
  return { url: value };
}

function dateProperty(ms: number | null) {
  const start = unixMsToIsoDate(ms);
  if (!start) return { date: null };
  return { date: { start } };
}

export function toNotionProperties(
  application: Application,
  titlePropertyName: string,
): Record<string, unknown> {
  return {
    [titlePropertyName]: titleProperty(
      displayTitle(application.company, application.role),
    ),
    [PROP.company]: richTextProperty(application.company),
    [PROP.role]: richTextProperty(application.role),
    [PROP.stage]: selectProperty(application.stage),
    [PROP.source]: selectProperty(application.source),
    [PROP.jobUrl]: urlProperty(application.jobUrl),
    [PROP.location]: richTextProperty(application.location),
    [PROP.resume]: richTextProperty(application.resumeLabel),
    [PROP.applied]: dateProperty(application.appliedAt),
    [PROP.applyBy]: dateProperty(application.applyBy),
    [PROP.nextAction]: richTextProperty(application.nextAction),
    [PROP.nextActionAt]: dateProperty(application.nextActionAt),
    [PROP.notes]: richTextProperty(application.notes),
    [PROP.archived]: { checkbox: application.archived },
    [PROP.trackerId]: richTextProperty(application.id),
  };
}

export function fromNotionPage(
  page: NotionPageLike,
  titlePropertyName: string,
): MappedNotionApplication {
  const title = readTitle(page.properties, titlePropertyName);
  const company =
    readRichText(page.properties, PROP.company) ??
    (title ? title.split(" — ")[0]?.trim() : null) ??
    "Unknown";
  const role =
    readRichText(page.properties, PROP.role) ??
    (title?.includes(" — ")
      ? title.slice(title.indexOf(" — ") + 3).trim()
      : title) ??
    "Untitled";

  return {
    company,
    role: role || "Untitled",
    stage: asStage(readSelect(page.properties, PROP.stage)),
    source: asSource(readSelect(page.properties, PROP.source)),
    jobUrl: readUrl(page.properties, PROP.jobUrl),
    location: readRichText(page.properties, PROP.location),
    resumeLabel: readRichText(page.properties, PROP.resume),
    appliedAt: readDate(page.properties, PROP.applied),
    applyBy: readDate(page.properties, PROP.applyBy),
    nextAction: readRichText(page.properties, PROP.nextAction),
    nextActionAt: readDate(page.properties, PROP.nextActionAt),
    notes: readRichText(page.properties, PROP.notes),
    archived: readCheckbox(page.properties, PROP.archived),
    trackerId: readRichText(page.properties, PROP.trackerId),
  };
}
