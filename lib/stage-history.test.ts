import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("records application stages across write paths and removes history on delete", async () => {
  const originalCwd = process.cwd();
  const fixtureDir = mkdtempSync(join(tmpdir(), "job-tracker-history-"));
  process.chdir(fixtureDir);
  try {
    const { upsertApplication, updateApplication, moveApplication, applyRemoteUpdate, recordReachedMilestone, deleteApplication, listStageHistory } = await import("./applications");
    const created = upsertApplication({ company: "Fixture", role: "Engineer", stage: "applied" }).application;
    updateApplication(created.id, { stage: "screening" });
    updateApplication(created.id, { stage: "screening" });
    moveApplication(created.id, "interview");
    applyRemoteUpdate(created.id, { stage: "rejected" }, { notionPageId: crypto.randomUUID(), notionLastEditedTime: new Date().toISOString() });
    assert.deepEqual(listStageHistory().filter((item) => item.applicationId === created.id).map((item) => item.stage), ["applied", "screening", "interview", "rejected"]);
    recordReachedMilestone(created.id, "interview");
    assert.equal(listStageHistory().filter((item) => item.applicationId === created.id && item.stage === "interview").length, 1);
    const older = upsertApplication({ company: "Older", role: "Engineer", stage: "rejected" }).application;
    recordReachedMilestone(older.id, "interview");
    recordReachedMilestone(older.id, "interview");
    assert.deepEqual(listStageHistory().filter((item) => item.applicationId === older.id).map((item) => item.stage), ["rejected", "interview"]);
    const withdrawn = upsertApplication({ company: "Unsubmitted", role: "Engineer", stage: "withdrawn" }).application;
    assert.throws(() => recordReachedMilestone(withdrawn.id, "interview"), /Submit the application/);
    deleteApplication(created.id);
    assert.equal(listStageHistory().filter((item) => item.applicationId === created.id).length, 0);
  } finally {
    process.chdir(originalCwd);
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
