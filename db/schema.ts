import { isNotNull } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { Source, Stage } from "../lib/types";

export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    company: text("company").notNull(),
    role: text("role").notNull(),
    stage: text("stage").notNull().$type<Stage>(),
    jobUrl: text("job_url"),
    source: text("source").$type<Source>(),
    location: text("location"),
    resumeLabel: text("resume_label"),
    appliedAt: integer("applied_at"),
    applyBy: integer("apply_by"),
    nextAction: text("next_action"),
    nextActionAt: integer("next_action_at"),
    notes: text("notes"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("applications_job_url_unique")
      .on(t.jobUrl)
      .where(isNotNull(t.jobUrl)),
  ],
);

export type ApplicationRow = typeof applications.$inferSelect;
