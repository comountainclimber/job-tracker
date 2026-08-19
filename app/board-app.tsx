"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { KanbanBoard } from "@/components/board/kanban-board";
import { AddApplicationDialog } from "@/components/forms/add-application-dialog";
import { ApplicationSheet } from "@/components/forms/application-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isNeedsAttention } from "@/lib/attention";
import type { Application } from "@/lib/types";

export function BoardApp({
  applications,
  archivedApplications,
}: {
  applications: Application[];
  archivedApplications: Application[];
}) {
  const [query, setQuery] = useState("");
  const [needsAttention, setNeedsAttention] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);

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
          <AddApplicationDialog />
        </div>
      </header>
      <div className="min-h-0 flex-1 p-3">
        <KanbanBoard
          applications={visible}
          showArchivedColumns={showArchived}
          onSelect={setSelected}
        />
      </div>
      <ApplicationSheet
        application={selectedFresh}
        open={selectedFresh !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
