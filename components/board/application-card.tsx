"use client";

import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cardDeadlineAt, cardTimingLabel, isStale } from "@/lib/attention";
import type { Application } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ApplicationCardView({
  application,
  className,
}: {
  application: Application;
  className?: string;
}) {
  const stale = isStale(application);
  const timing = cardTimingLabel(application);
  const deadline = cardDeadlineAt(application);
  const overdue = deadline != null && deadline < Date.now();

  return (
    <Card
      size="sm"
      className={cn(
        "gap-1 py-2.5 shadow-none hover:bg-accent/40",
        stale && "ring-amber-500/70",
        className,
      )}
    >
      <CardHeader className="gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 truncate font-semibold">
            {application.company}
          </CardTitle>
          <span
            suppressHydrationWarning
            title={
              deadline
                ? new Date(deadline).toLocaleString()
                : "Days in this stage"
            }
            className={cn(
              "shrink-0 font-mono text-xs text-muted-foreground",
              overdue && "text-amber-600 dark:text-amber-400",
            )}
          >
            {timing}
          </span>
        </div>
        <CardDescription className="truncate">{application.role}</CardDescription>
      </CardHeader>
      {stale || application.nextAction ? (
        <CardContent className="flex items-center gap-1.5">
          {stale ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            >
              Stale
            </Badge>
          ) : null}
          {application.nextAction ? (
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {application.nextAction}
            </p>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function ApplicationCard({
  application,
  onSelect,
  enableDnd = true,
}: {
  application: Application;
  onSelect: (app: Application) => void;
  enableDnd?: boolean;
}) {
  if (enableDnd) {
    return <DraggableApplicationCard application={application} onSelect={onSelect} />;
  }

  return (
    <button
      type="button"
      className="w-full cursor-pointer text-left"
      aria-label={`${application.company} — ${application.role}`}
      onClick={() => onSelect(application)}
    >
      <ApplicationCardView application={application} />
    </button>
  );
}

function DraggableApplicationCard({
  application,
  onSelect,
}: {
  application: Application;
  onSelect: (app: Application) => void;
}) {
  const didDragRef = useRef(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: application.id,
    data: { type: "application", stage: application.stage },
  });

  useEffect(() => {
    if (isDragging) {
      didDragRef.current = true;
    }
  }, [isDragging]);

  function handleSelect() {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onSelect(application);
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "cursor-grab touch-none select-none",
        isDragging && "cursor-grabbing opacity-30",
      )}
      {...listeners}
      {...attributes}
      aria-label={`${application.company} — ${application.role}`}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleSelect();
        }
      }}
    >
      <ApplicationCardView application={application} />
    </div>
  );
}
