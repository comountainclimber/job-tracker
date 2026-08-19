"use client";

import { startTransition, useOptimistic, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { ApplicationCardView } from "@/components/board/application-card";
import { KanbanColumn } from "@/components/board/kanban-column";
import { moveApplication } from "@/app/actions";
import {
  HIDDEN_BY_DEFAULT_STAGES,
  PIPELINE_STAGES,
  STAGES,
  type Application,
  type Stage,
} from "@/lib/types";

const collisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    return pointerHits;
  }
  return closestCorners(args);
};

function isStage(value: unknown): value is Stage {
  return (
    typeof value === "string" && (STAGES as readonly string[]).includes(value)
  );
}

export function KanbanBoard({
  applications,
  onSelect,
  showArchivedColumns = false,
}: {
  applications: Application[];
  onSelect: (app: Application) => void;
  showArchivedColumns?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimisticApps, applyMove] = useOptimistic(
    applications,
    (current, move: { id: string; stage: Stage }) =>
      current.map((app) =>
        app.id === move.id ? { ...app, stage: move.stage } : app,
      ),
  );

  const columns = showArchivedColumns
    ? [...PIPELINE_STAGES, ...HIDDEN_BY_DEFAULT_STAGES]
    : PIPELINE_STAGES;

  const byStage = Object.fromEntries(
    STAGES.map((stage) => [stage, [] as Application[]]),
  ) as Record<Stage, Application[]>;

  for (const app of optimisticApps) {
    byStage[app.stage].push(app);
  }

  const activeApp =
    activeId === null
      ? undefined
      : optimisticApps.find((app) => app.id === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) {
      return;
    }

    const fromStage = active.data.current?.stage;
    const toStage = over.data.current?.stage;
    if (!isStage(fromStage) || !isStage(toStage) || fromStage === toStage) {
      return;
    }

    const id = String(active.id);
    startTransition(async () => {
      applyMove({ id, stage: toStage });
      await moveApplication(id, toStage);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-0 w-full gap-3 overflow-x-auto bg-background text-foreground">
        {columns.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            applications={byStage[stage]}
            onSelect={onSelect}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeApp ? (
          <ApplicationCardView
            application={activeApp}
            className="cursor-grabbing shadow-lg ring-foreground/15"
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
