import type { Application, Stage } from "@/lib/types";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_AFTER_DAYS = 7;
export const APPLY_BY_SOON_DAYS = 3;

const STALE_STAGES: Stage[] = ["applied", "screening"];

export function daysInStage(app: Application, now = Date.now()): number {
  const start = app.appliedAt ?? app.createdAt;
  return Math.max(0, Math.floor((now - start) / DAY_MS));
}

function startOfLocalDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function calendarDaysUntil(target: number, now = Date.now()): number {
  return Math.round((startOfLocalDay(target) - startOfLocalDay(now)) / DAY_MS);
}

/** Upcoming deadline on the card: next action, else wishlist apply-by. */
export function cardDeadlineAt(app: Application): number | null {
  if (app.nextActionAt != null) return app.nextActionAt;
  if (app.stage === "wishlist" && app.applyBy != null) return app.applyBy;
  return null;
}

export function cardTimingLabel(app: Application, now = Date.now()): string {
  const deadline = cardDeadlineAt(app);
  if (deadline == null) {
    return `${daysInStage(app, now)}d`;
  }

  const days = calendarDaysUntil(deadline, now);
  const time = new Date(deadline).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (days === 0) return `today ${time}`;
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 1) return `in ${days}d`;
  return `${Math.abs(days)}d ago`;
}

export function isStale(app: Application, now = Date.now()): boolean {
  if (app.archived) return false;
  if (!STALE_STAGES.includes(app.stage)) return false;
  return now - app.updatedAt >= STALE_AFTER_DAYS * DAY_MS;
}

export function isApplyBySoon(app: Application, now = Date.now()): boolean {
  if (app.archived || app.stage !== "wishlist" || app.applyBy == null) {
    return false;
  }
  return app.applyBy <= now + APPLY_BY_SOON_DAYS * DAY_MS;
}

export function isNextActionOverdue(
  app: Application,
  now = Date.now(),
): boolean {
  if (app.archived || app.nextActionAt == null) return false;
  return app.nextActionAt <= now;
}

export function isNeedsAttention(app: Application, now = Date.now()): boolean {
  return isStale(app, now) || isApplyBySoon(app, now) || isNextActionOverdue(app, now);
}
