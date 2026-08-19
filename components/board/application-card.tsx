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
import { daysInStage, isStale } from "@/lib/attention";
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
  const days = daysInStage(application);

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
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {days}d
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
