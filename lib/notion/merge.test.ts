import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideMerge } from "./merge";

describe("decideMerge", () => {
  it("skips when neither side is dirty (echo after a successful push)", () => {
    const decision = decideMerge({
      local: {
        updatedAt: 1_000,
        notionSyncedAt: 2_000,
        notionLastEditedTime: "2026-08-25T12:00:00.000Z",
      },
      remoteLastEditedTime: "2026-08-25T12:00:00.000Z",
    });
    assert.equal(decision, "skip");
  });

  it("pushes when only local is dirty", () => {
    const decision = decideMerge({
      local: {
        updatedAt: 3_000,
        notionSyncedAt: 2_000,
        notionLastEditedTime: "2026-08-25T12:00:00.000Z",
      },
      remoteLastEditedTime: "2026-08-25T12:00:00.000Z",
    });
    assert.equal(decision, "push");
  });

  it("pulls when only Notion is dirty", () => {
    const decision = decideMerge({
      local: {
        updatedAt: 1_000,
        notionSyncedAt: 2_000,
        notionLastEditedTime: "2026-08-25T12:00:00.000Z",
      },
      remoteLastEditedTime: "2026-08-25T13:00:00.000Z",
    });
    assert.equal(decision, "pull");
  });

  it("prefers the later timestamp when both are dirty", () => {
    const localNewer = decideMerge({
      local: {
        updatedAt: Date.parse("2026-08-25T14:00:00.000Z"),
        notionSyncedAt: 1,
        notionLastEditedTime: "2026-08-25T12:00:00.000Z",
      },
      remoteLastEditedTime: "2026-08-25T13:00:00.000Z",
    });
    assert.equal(localNewer, "push");

    const remoteNewer = decideMerge({
      local: {
        updatedAt: Date.parse("2026-08-25T12:30:00.000Z"),
        notionSyncedAt: 1,
        notionLastEditedTime: "2026-08-25T12:00:00.000Z",
      },
      remoteLastEditedTime: "2026-08-25T13:00:00.000Z",
    });
    assert.equal(remoteNewer, "pull");
  });

  it("prefers local on a timestamp tie", () => {
    const ts = "2026-08-25T12:00:00.000Z";
    const decision = decideMerge({
      local: {
        updatedAt: Date.parse(ts),
        notionSyncedAt: 1,
        notionLastEditedTime: "2026-08-25T11:00:00.000Z",
      },
      remoteLastEditedTime: ts,
    });
    assert.equal(decision, "push");
  });
});
