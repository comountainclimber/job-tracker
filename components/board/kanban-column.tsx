"use client";

import { useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";

import { ApplicationCard } from "@/components/board/application-card";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABELS, type Application, type Stage } from "@/lib/types";
import { cn } from "@/lib/utils";

export function columnDroppableId(stage: Stage) {
  return `column:${stage}`;
}

export function KanbanColumn({
  stage,
  applications,
  onSelect,
}: {
  stage: Stage;
  applications: Application[];
  onSelect: (app: Application) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(stage),
    data: { type: "column", stage },
  });

  const label = STAGE_LABELS[stage];
  const isEmptyWishlist = stage === "wishlist" && applications.length === 0;

  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${applications.length}`}
      className={cn(
        "flex min-h-72 min-w-[16.5rem] flex-1 flex-col rounded-xl bg-muted/30 ring-1 ring-foreground/10",
        isOver && "bg-accent/50 ring-ring",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <h2 className="text-sm font-medium text-foreground">{label}</h2>
        <Badge variant="secondary">{applications.length}</Badge>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {applications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            onSelect={onSelect}
          />
        ))}
        {isEmptyWishlist ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-3 py-8 text-center">
            <Inbox className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No roles saved yet</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
