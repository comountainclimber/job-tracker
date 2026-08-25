import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayTitle,
  fromNotionPage,
  parseNotionDatabaseId,
  unixMsToIsoDate,
  isoDateToUnixMs,
  toNotionProperties,
  type NotionPageLike,
} from "./map";
import type { Application } from "../types";

describe("parseNotionDatabaseId", () => {
  it("parses a dashed UUID", () => {
    const id = parseNotionDatabaseId("12345678-1234-1234-1234-123456789abc");
    assert.equal(id, "12345678-1234-1234-1234-123456789abc");
  });

  it("parses a 32-character hex id from a URL", () => {
    const id = parseNotionDatabaseId(
      "https://www.notion.so/workspace/Job-tracker-12345678123412341234123456789abc?v=viewid",
    );
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.equal(id.replace(/-/g, ""), "12345678123412341234123456789abc");
  });

  it("rejects empty input", () => {
    assert.throws(() => parseNotionDatabaseId("   "), /required/i);
  });
});

describe("date conversion", () => {
  it("round-trips a UTC calendar date", () => {
    const ms = isoDateToUnixMs("2026-08-25");
    assert.equal(unixMsToIsoDate(ms), "2026-08-25");
  });
});

describe("notion property map", () => {
  const application: Application = {
    id: "app-1",
    company: "Acme",
    role: "Staff Engineer",
    stage: "applied",
    jobUrl: "https://example.com/jobs/staff",
    source: "linkedin",
    location: "Remote",
    resumeLabel: "v3",
    appliedAt: isoDateToUnixMs("2026-08-01"),
    applyBy: null,
    nextAction: "Follow up",
    nextActionAt: isoDateToUnixMs("2026-08-10"),
    notes: "JD: distributed systems",
    archived: false,
    createdAt: 1,
    updatedAt: 2,
    notionPageId: "page-1",
  };

  it("builds a display title and round-trips fields", () => {
    assert.equal(displayTitle("Acme", "Staff Engineer"), "Acme — Staff Engineer");
    const properties = toNotionProperties(application, "Name");
    const page: NotionPageLike = {
      id: "page-1",
      last_edited_time: "2026-08-25T12:00:00.000Z",
      properties: {
        Name: {
          type: "title",
          title: [{ plain_text: "Acme — Staff Engineer" }],
        },
        Company: {
          type: "rich_text",
          rich_text: [{ plain_text: "Acme" }],
        },
        Role: {
          type: "rich_text",
          rich_text: [{ plain_text: "Staff Engineer" }],
        },
        Stage: { type: "select", select: { name: "applied" } },
        Source: { type: "select", select: { name: "linkedin" } },
        "Job URL": { type: "url", url: "https://example.com/jobs/staff" },
        Location: {
          type: "rich_text",
          rich_text: [{ plain_text: "Remote" }],
        },
        Resume: { type: "rich_text", rich_text: [{ plain_text: "v3" }] },
        Applied: { type: "date", date: { start: "2026-08-01" } },
        "Apply by": { type: "date", date: null },
        "Next action": {
          type: "rich_text",
          rich_text: [{ plain_text: "Follow up" }],
        },
        "Next action at": { type: "date", date: { start: "2026-08-10" } },
        Notes: {
          type: "rich_text",
          rich_text: [{ plain_text: "JD: distributed systems" }],
        },
        Archived: { type: "checkbox", checkbox: false },
        "Tracker ID": {
          type: "rich_text",
          rich_text: [{ plain_text: "app-1" }],
        },
      },
    };
    const mapped = fromNotionPage(page, "Name");
    assert.equal(mapped.company, application.company);
    assert.equal(mapped.role, application.role);
    assert.equal(mapped.stage, application.stage);
    assert.equal(mapped.source, application.source);
    assert.equal(mapped.jobUrl, application.jobUrl);
    assert.equal(mapped.trackerId, application.id);
    assert.equal(mapped.appliedAt, application.appliedAt);
    assert.ok("Name" in properties);
    assert.ok("Tracker ID" in properties);
  });

  it("falls back to title when company/role properties are missing", () => {
    const mapped = fromNotionPage(
      {
        id: "page-2",
        last_edited_time: "2026-08-25T12:00:00.000Z",
        properties: {
          Name: {
            type: "title",
            title: [{ plain_text: "Globex — Intern" }],
          },
        },
      },
      "Name",
    );
    assert.equal(mapped.company, "Globex");
    assert.equal(mapped.role, "Intern");
    assert.equal(mapped.stage, "wishlist");
  });

  it("chunks rich text over Notion's 2000 character limit", () => {
    const notes = "x".repeat(5189);
    const properties = toNotionProperties({ ...application, notes }, "Name") as {
      Notes: { rich_text: Array<{ text: { content: string } }> };
    };
    assert.equal(properties.Notes.rich_text.length, 3);
    assert.equal(properties.Notes.rich_text[0]?.text.content.length, 2000);
    assert.equal(properties.Notes.rich_text[2]?.text.content.length, 1189);
  });
});
