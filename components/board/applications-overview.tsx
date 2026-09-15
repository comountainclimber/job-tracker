"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip } from "radix-ui";
import { calculateAnalytics, type AnalyticsGroup, type AnalyticsHistory, type AnalyticsPeriod } from "@/lib/analytics";
import { STAGE_LABELS, type Application } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

function currentStatus(app: Application): { label: string; variant: "secondary" | "destructive" | "outline" } {
  if (app.stage === "rejected") return { label: "Rejected", variant: "destructive" };
  if (app.stage === "withdrawn") return { label: "Withdrawn", variant: "outline" };
  if (app.archived) return { label: `Archived · ${STAGE_LABELS[app.stage]}`, variant: "outline" };
  if (app.stage === "wishlist") return { label: "Wishlist", variant: "outline" };
  return { label: `Active · ${STAGE_LABELS[app.stage]}`, variant: "secondary" };
}

function ChartBarTooltip({ group, applications }: { group: AnalyticsGroup; applications: Application[] }) {
  const byId = new Map(applications.map((app) => [app.id, app]));
  const matches = group.ids.map((id) => byId.get(id)).filter((app): app is Application => app != null);

  return (
    <Tooltip.Portal>
      <Tooltip.Content
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="z-50 max-h-64 w-[min(19rem,calc(100vw-1.5rem))] overflow-y-auto rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md"
      >
        <p className="text-sm font-semibold">{group.label} · {group.count} {group.count === 1 ? "application" : "applications"}</p>
        {matches.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No applications in this bar.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {matches.map((app) => (
              <li key={app.id} className="flex items-start justify-between gap-2 text-xs">
                <span className="min-w-0 break-words">{app.company} · {app.role}</span>
                <Badge variant={currentStatus(app).variant}>{currentStatus(app).label}</Badge>
              </li>
            ))}
          </ul>
        )}
        <Tooltip.Arrow className="fill-popover" />
      </Tooltip.Content>
    </Tooltip.Portal>
  );
}

export function ApplicationsOverview({ applications, history, onSelect }: {
  applications: Application[];
  history: AnalyticsHistory[];
  onSelect: (application: Application) => void;
}) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("all");
  const [collapsed, setCollapsed] = useState(false);
  const [inspection, setInspection] = useState<AnalyticsGroup | null>(null);
  const analytics = useMemo(() => calculateAnalytics(applications, history, period), [applications, history, period]);
  const matches = inspection?.ids.map((id) => applications.find((app) => app.id === id)).filter((app): app is Application => app != null) ?? [];
  const maxWeek = Math.max(1, ...analytics.weeks.map((week) => week.count));
  const maxStage = Math.max(1, ...analytics.stages.map((stage) => stage.count));
  const cards = [
    { group: analytics.totalApplied, caption: "Submitted applications" },
    { group: analytics.screenings, caption: "Reached screening" },
    { group: analytics.interviews, caption: "Reached interview" },
    { group: analytics.rejections, caption: "Rejection recorded" },
  ];

  function inspect(group: AnalyticsGroup) {
    setInspection(group);
    setCollapsed(false);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4" aria-labelledby="applications-overview-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="applications-overview-title" className="text-sm font-semibold">Applications by the numbers</h2>
          <p className="text-xs text-muted-foreground">All applications, including archived outcomes; independent of board search and Show archived.</p>
        </div>
        <Button type="button" size="sm" variant="ghost" aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          {collapsed ? "Expand" : "Collapse"}
        </Button>
      </div>
      {!collapsed && <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Applications submitted:</span>
          {PERIODS.map((option) => <Button key={option.value} type="button" size="sm" variant={period === option.value ? "default" : "outline"} aria-pressed={period === option.value} onClick={() => { setPeriod(option.value); setInspection(null); }}>{option.label}</Button>)}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {cards.map(({ group, caption }) => <button key={group.label} type="button" className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => inspect(group)} aria-label={`${group.label}: ${group.count}. View matching applications`}>
            <span className="block text-2xl font-semibold tabular-nums sm:text-3xl">{group.count}</span>
            <span className="block text-sm font-medium">{group.label}</span>
            <span className="block text-xs text-muted-foreground">{caption}</span>
          </button>)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {[analytics.active, analytics.offers, analytics.followUpsDue].map((group) => <button key={group.label} type="button" className="hover:underline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => inspect(group)}>{group.label} <strong className="font-medium text-foreground">{group.count}</strong></button>)}
        </div>
        <Tooltip.Provider delayDuration={150}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">Applications over time</h3>
            <div className="flex h-28 items-end gap-1" role="group" aria-label="Submitted applications by week for the last 12 weeks">
              {analytics.weeks.map((week) => <Tooltip.Root key={week.start}>
                <Tooltip.Trigger asChild>
                  <button type="button" aria-label={`Week of ${week.label}: ${week.count} applications. View matching applications`} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => inspect(week)}>
                    <span className="block min-h-1 rounded-t bg-primary/75 group-hover:bg-primary" style={{ height: `${Math.max(4, (week.count / maxWeek) * 88)}%` }} />
                    <span className="truncate text-center text-[10px] text-muted-foreground">{week.label}</span>
                  </button>
                </Tooltip.Trigger>
                <ChartBarTooltip group={week} applications={applications} />
              </Tooltip.Root>)}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Current application stages</h3>
            <div className="space-y-1" role="group" aria-label="Current stages for the selected submission period">
              {analytics.stages.map((stage) => <Tooltip.Root key={stage.stage}>
                <Tooltip.Trigger asChild>
                  <button type="button" className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-label={`${stage.label}: ${stage.count}. View matching applications`} onClick={() => inspect(stage)}>
                    <span className="w-20 shrink-0 text-xs">{stage.label}</span>
                    <span className="h-2 flex-1 rounded bg-muted"><span className="block h-full rounded bg-primary/75" style={{ width: `${(stage.count / maxStage) * 100}%` }} /></span>
                    <span className="w-6 text-right text-xs tabular-nums">{stage.count}</span>
                  </button>
                </Tooltip.Trigger>
                <ChartBarTooltip group={stage} applications={applications} />
              </Tooltip.Root>)}
            </div>
          </div>
        </div>
        </Tooltip.Provider>
        <p className="text-xs text-muted-foreground">Milestone history starts with each existing application’s known stage; earlier screenings and interviews may be missing. {analytics.dateMissing} submitted {analytics.dateMissing === 1 ? "application has" : "applications have"} an application date missing and {analytics.dateMissing === 1 ? "is" : "are"} excluded from dated views. {analytics.withdrawnBeforeApplying} {analytics.withdrawnBeforeApplying === 1 ? "lead was" : "leads were"} withdrawn before applying; {analytics.withdrawnBeforeApplying === 1 ? "it appears" : "they appear"} in the all-time Withdrawn bar but not submission totals or dated cohorts.</p>
        {inspection && <div className="rounded-lg border border-border p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{inspection.label} · {matches.length}</h3><Button type="button" size="sm" variant="ghost" onClick={() => setInspection(null)}>Close</Button></div>
          {matches.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">No matching applications.</p> : <div className="mt-2 max-h-40 space-y-1 overflow-auto">{matches.map((app) => {
            const status = currentStatus(app);
            return <button key={app.id} type="button" className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" onClick={() => onSelect(app)}>
              <span className="min-w-0 truncate" title={`${app.company} · ${app.role}`}>{app.company} · {app.role}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </button>;
          })}</div>}
        </div>}
      </div>}
    </section>
  );
}
