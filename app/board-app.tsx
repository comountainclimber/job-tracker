"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { KanbanBoard } from "@/components/board/kanban-board";
import { ApplicationsOverview } from "@/components/board/applications-overview";
import { AddApplicationDialog } from "@/components/forms/add-application-dialog";
import { ApplicationSheet } from "@/components/forms/application-sheet";
import { NotionSettingsDialog } from "@/components/forms/notion-settings-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { syncNotionNow } from "@/app/actions";
import { isNeedsAttention } from "@/lib/attention";
import type { AnalyticsHistory } from "@/lib/analytics";
import type { Application, NotionPublicSettings, NotionSyncStatus } from "@/lib/types";

const SYNC_POLL_MS = 60_000;

function formatSyncedAt(ms: number | null): string | null {
  if (ms == null) return null;
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BoardApp({
  applications,
  archivedApplications,
  overviewApplications: providedOverviewApplications,
  stageHistory: providedStageHistory,
  notion,
}: {
  applications: Application[];
  archivedApplications: Application[];
  overviewApplications?: Application[];
  stageHistory?: AnalyticsHistory[];
  notion: NotionPublicSettings;
}) {
  const router = useRouter();
  const overviewApplications = providedOverviewApplications ?? [...applications, ...archivedApplications];
  const stageHistory = providedStageHistory ?? [];
  const [query, setQuery] = useState("");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [syncStatus, setSyncStatus] = useState<NotionSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (providedOverviewApplications == null || providedStageHistory == null) {
      router.refresh();
    }
  }, [providedOverviewApplications, providedStageHistory, router]);

  const attentionCount = useMemo(
    () => applications.filter((app) => isNeedsAttention(app)).length,
    [applications],
  );

  const visible = useMemo(() => {
    const pool = showArchived
      ? [...applications, ...archivedApplications]
      : applications;
    const q = query.trim().toLowerCase();
    return pool.filter((app) => {
      if (needsAttention && !isNeedsAttention(app)) return false;
      if (!q) return true;
      return [app.company, app.role, app.jobUrl, app.notes, app.location]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    });
  }, [applications, archivedApplications, needsAttention, query, showArchived]);

  const selectedFresh =
    selected === null
      ? null
      : [...applications, ...archivedApplications].find(
          (app) => app.id === selected.id,
        ) ?? selected;

  useEffect(() => {
    if (!notion.enabled) {
      setSyncStatus(null);
      return;
    }
    let cancelled = false;

    async function pull() {
      try {
        const data = await syncNotionNow();
        if (!cancelled) {
          setSyncStatus(data);
          router.refresh();
        }
      } catch {
        // Keep the last status if a background sync fails.
      }
    }

    void pull();
    const interval = window.setInterval(() => {
      void pull();
    }, SYNC_POLL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void pull();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [notion.enabled, router]);

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      const result = await syncNotionNow();
      setSyncStatus(result);
      router.refresh();
    } catch (err) {
      setSyncStatus((current) => ({
        enabled: notion.enabled,
        source: notion.source,
        lastSyncedAt: current?.lastSyncedAt ?? null,
        error: err instanceof Error ? err.message : "Sync failed.",
      }));
    } finally {
      setIsSyncing(false);
    }
  }

  const syncedLabel = formatSyncedAt(
    syncStatus?.lastSyncedAt ?? null,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight">Job tracker</h1>
          <p className="text-xs text-muted-foreground">
            Local pipeline — {applications.length} active
          </p>
        </div>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, role, URL…"
            className="pl-8"
            aria-label="Search applications"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={needsAttention ? "default" : "outline"}
            onClick={() => setNeedsAttention((value) => !value)}
          >
            Needs attention
            <span className="font-mono text-xs opacity-80">{attentionCount}</span>
          </Button>
          <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-1">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-xs">
              Show archived
            </Label>
          </div>
          <NotionSettingsDialog
            key={`${notion.enabled}:${notion.source ?? ""}:${notion.databaseId ?? ""}`}
            initial={notion}
          />
          {notion.enabled ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSyncing}
                onClick={() => {
                  void handleSyncNow();
                }}
              >
                {isSyncing ? "Syncing…" : "Sync now"}
              </Button>
              <p
                className="max-w-40 truncate text-xs text-muted-foreground"
                title={syncStatus?.error ?? undefined}
              >
                {syncStatus?.error
                  ? syncStatus.error
                  : syncedLabel
                    ? `Synced ${syncedLabel}`
                    : "Not synced yet"}
              </p>
            </>
          ) : null}
          <AddApplicationDialog />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <ApplicationsOverview applications={overviewApplications} history={stageHistory} onSelect={setSelected} />
        <div className="mt-3 h-[65vh] min-h-[24rem]">
          <KanbanBoard
            applications={visible}
            showArchivedColumns={showArchived}
            onSelect={setSelected}
          />
        </div>
      </div>
      <ApplicationSheet
        application={selectedFresh}
        reachedStages={stageHistory.filter((event) => event.applicationId === selectedFresh?.id).map((event) => event.stage)}
        open={selectedFresh !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
