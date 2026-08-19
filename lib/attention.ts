import type { Application, Stage } from "@/lib/types";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_AFTER_DAYS = 7;
export const APPLY_BY_SOON_DAYS = 3;

const STALE_STAGES: Stage[] = ["applied", "screening"];

export function daysInStage(app: Application, now = Date.now()): number {
  const start = app.appliedAt ?? app.createdAt;
  return Math.max(0, Math.floor((now - start) / DAY_MS));
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
