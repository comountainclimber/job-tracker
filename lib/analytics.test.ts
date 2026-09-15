import assert from "node:assert/strict";
import test from "node:test";
import { calculateAnalytics } from "./analytics";
import type { Application } from "./types";

const now = Date.UTC(2026, 8, 15, 12);
function app(id: string, stage: Application["stage"], appliedAt: number | null, archived = false): Application {
  return {
    id, company: id, role: "Engineer", stage, appliedAt, archived,
    jobUrl: null, source: null, location: null, resumeLabel: null, applyBy: null,
    nextAction: null, nextActionAt: null, notes: null, createdAt: now,
    updatedAt: now, notionPageId: null,
  };
}

test("counts reached milestones once without inventing skipped stages", () => {
  const apps = [app("repeat", "rejected", now - 2 * 86_400_000, true), app("skip", "offer", now - 3 * 86_400_000)];
  const history = [
    { applicationId: "repeat", stage: "screening" as const },
    { applicationId: "repeat", stage: "interview" as const },
    { applicationId: "repeat", stage: "screening" as const },
    { applicationId: "repeat", stage: "interview" as const },
    { applicationId: "repeat", stage: "rejected" as const },
    { applicationId: "skip", stage: "offer" as const },
  ];
  const result = calculateAnalytics(apps, history, "all", now);
  assert.equal(result.totalApplied.count, 2);
  assert.deepEqual(result.screenings.ids, ["repeat"]);
  assert.deepEqual(result.interviews.ids, ["repeat"]);
  assert.deepEqual(result.rejections.ids, ["repeat"]);
  assert.equal(result.stages.find((stage) => stage.stage === "rejected")?.count, 1);
});

test("submission cohort uses inclusive boundary and excludes missing dates", () => {
  const boundary = now - 30 * 86_400_000;
  const apps = [app("boundary", "screening", boundary), app("older", "rejected", boundary - 1, true), app("undated", "applied", null), app("wish", "wishlist", null)];
  const all = calculateAnalytics(apps, [], "all", now);
  const recent = calculateAnalytics(apps, [], "30", now);
  assert.equal(all.totalApplied.count, 3);
  assert.equal(all.dateMissing, 1);
  assert.deepEqual(recent.totalApplied.ids, ["boundary"]);
  assert.equal(recent.screenings.count, 1);
  assert.equal(recent.dateMissing, 1);
});

test("withdrawn leads remain visible without counting as submitted applications", () => {
  const apps = [
    app("unsubmitted", "withdrawn", null),
    app("submitted", "withdrawn", now - 2 * 86_400_000),
    app("historical", "withdrawn", null),
  ];
  const history = [{ applicationId: "historical", stage: "applied" as const }];
  const all = calculateAnalytics(apps, history, "all", now);
  const recent = calculateAnalytics(apps, history, "30", now);
  assert.deepEqual(all.totalApplied.ids, ["submitted", "historical"]);
  assert.equal(all.withdrawnBeforeApplying, 1);
  assert.equal(all.dateMissing, 1);
  assert.deepEqual(all.stages.find((stage) => stage.stage === "withdrawn")?.ids, ["unsubmitted", "submitted", "historical"]);
  assert.deepEqual(recent.stages.find((stage) => stage.stage === "withdrawn")?.ids, ["submitted"]);
});
