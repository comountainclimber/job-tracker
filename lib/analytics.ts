import { STAGE_LABELS, type Application, type Stage } from "./types";

export type AnalyticsPeriod = "all" | "30" | "90";
export type AnalyticsHistory = { applicationId: string; stage: Stage };
export type AnalyticsGroup = { label: string; count: number; ids: string[] };
export type Analytics = {
  totalApplied: AnalyticsGroup;
  screenings: AnalyticsGroup;
  interviews: AnalyticsGroup;
  rejections: AnalyticsGroup;
  active: AnalyticsGroup;
  offers: AnalyticsGroup;
  followUpsDue: AnalyticsGroup;
  dateMissing: number;
  withdrawnBeforeApplying: number;
  stages: (AnalyticsGroup & { stage: Stage })[];
  weeks: (AnalyticsGroup & { start: number })[];
};

const CURRENT_STAGES: Stage[] = ["applied", "screening", "interview", "offer", "rejected", "withdrawn"];
const ACTIVE_STAGES: Stage[] = ["applied", "screening", "interview", "offer"];
const DAY = 86_400_000;

function group(label: string, apps: Application[], predicate: (app: Application) => boolean): AnalyticsGroup {
  const ids = apps.filter(predicate).map((app) => app.id);
  return { label, count: ids.length, ids };
}

function weekStart(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((day + 6) % 7));
}

export function calculateAnalytics(
  applications: Application[],
  history: AnalyticsHistory[],
  period: AnalyticsPeriod = "all",
  now = Date.now(),
): Analytics {
  const reached = new Map<string, Set<Stage>>();
  for (const event of history) {
    const stages = reached.get(event.applicationId) ?? new Set<Stage>();
    stages.add(event.stage);
    reached.set(event.applicationId, stages);
  }
  const submittedStages: Stage[] = ["applied", "screening", "interview", "offer", "rejected"];
  const submitted = applications.filter((app) =>
    app.appliedAt != null || submittedStages.includes(app.stage) ||
    [...(reached.get(app.id) ?? [])].some((stage) => submittedStages.includes(stage)),
  );
  const submittedIds = new Set(submitted.map((app) => app.id));
  const cutoff = period === "all" ? null : now - Number(period) * DAY;
  const cohort = submitted.filter((app) =>
    cutoff == null || (app.appliedAt != null && app.appliedAt >= cutoff && app.appliedAt <= now),
  );
  const hasReached = (app: Application, stage: Stage) =>
    app.stage === stage || reached.get(app.id)?.has(stage) === true;
  const current = (stage: Stage) => group(
    STAGE_LABELS[stage],
    stage === "withdrawn" && period === "all" ? applications : cohort,
    (app) => app.stage === stage,
  );
  const thisWeek = weekStart(now);
  const weeks = Array.from({ length: 12 }, (_, index) => {
    const start = thisWeek - (11 - index) * 7 * DAY;
    const items = submitted.filter((app) => app.appliedAt != null && app.appliedAt >= start && app.appliedAt < start + 7 * DAY && app.appliedAt <= now);
    return { label: new Date(start).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }), start, count: items.length, ids: items.map((app) => app.id) };
  });
  return {
    totalApplied: group("Total applied", cohort, () => true),
    screenings: group("Total screenings", cohort, (app) => hasReached(app, "screening")),
    interviews: group("Total interviews", cohort, (app) => hasReached(app, "interview")),
    rejections: group("Total rejections", cohort, (app) => hasReached(app, "rejected")),
    active: group("Active applications", cohort, (app) => ACTIVE_STAGES.includes(app.stage) && !app.archived),
    offers: group("Offers", cohort, (app) => app.stage === "offer"),
    followUpsDue: group("Follow-ups due", cohort, (app) => ACTIVE_STAGES.includes(app.stage) && !app.archived && app.nextActionAt != null && app.nextActionAt <= now),
    dateMissing: submitted.filter((app) => app.appliedAt == null).length,
    withdrawnBeforeApplying: applications.filter((app) => app.stage === "withdrawn" && !submittedIds.has(app.id)).length,
    stages: CURRENT_STAGES.map((stage) => ({ ...current(stage), stage })),
    weeks,
  };
}
