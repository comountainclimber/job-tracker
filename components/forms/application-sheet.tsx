"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink } from "lucide-react";
import {
  archiveApplication,
  deleteApplication,
  updateApplication,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Application, Source, Stage } from "@/lib/types";
import {
  SOURCE_LABELS,
  SOURCES,
  STAGE_LABELS,
  STAGES,
} from "@/lib/types";
import { notionPageUrl } from "@/lib/notion/map";

const SOURCE_UNSET = "__unset__";

function dateInputToUnixMs(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Date.UTC(year, month - 1, day, 12, 0, 0, 0);
}

function unixMsToDateInput(ms: number | null): string {
  if (ms == null) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function hrefForUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

type SheetForm = {
  company: string;
  role: string;
  stage: Stage;
  jobUrl: string;
  source: Source | typeof SOURCE_UNSET;
  location: string;
  resumeLabel: string;
  appliedAt: string;
  applyBy: string;
  nextAction: string;
  nextActionAt: string;
  notes: string;
};

function formFromApplication(application: Application): SheetForm {
  return {
    company: application.company,
    role: application.role,
    stage: application.stage,
    jobUrl: application.jobUrl ?? "",
    source: application.source ?? SOURCE_UNSET,
    location: application.location ?? "",
    resumeLabel: application.resumeLabel ?? "",
    appliedAt: unixMsToDateInput(application.appliedAt),
    applyBy: unixMsToDateInput(application.applyBy),
    nextAction: application.nextAction ?? "",
    nextActionAt: unixMsToDateInput(application.nextActionAt),
    notes: application.notes ?? "",
  };
}

export function ApplicationSheet(props: {
  application: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { application, open, onOpenChange } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {application ? (
        <ApplicationSheetBody
          key={application.id}
          application={application}
          onOpenChange={onOpenChange}
        />
      ) : null}
    </Sheet>
  );
}

function ApplicationSheetBody({
  application,
  onOpenChange,
}: {
  application: Application;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<SheetForm>(() =>
    formFromApplication(application),
  );
  const [archived, setArchived] = useState(application.archived);
  const [errors, setErrors] = useState<{ company?: string; role?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const jobHref = hrefForUrl(form.jobUrl);

  function patch<K extends keyof SheetForm>(key: K, value: SheetForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCompany = form.company.trim();
    const trimmedRole = form.role.trim();
    const nextErrors: { company?: string; role?: string } = {};
    if (!trimmedCompany) nextErrors.company = "Company is required.";
    if (!trimmedRole) nextErrors.role = "Role is required.";
    setErrors(nextErrors);
    setFormError(null);
    if (!trimmedCompany || !trimmedRole) return;

    setIsPending(true);
    try {
      const updated = await updateApplication(application.id, {
        company: trimmedCompany,
        role: trimmedRole,
        stage: form.stage,
        jobUrl: emptyToNull(form.jobUrl),
        source: form.source === SOURCE_UNSET ? null : form.source,
        location: emptyToNull(form.location),
        resumeLabel: emptyToNull(form.resumeLabel),
        appliedAt: dateInputToUnixMs(form.appliedAt),
        applyBy: dateInputToUnixMs(form.applyBy),
        nextAction: emptyToNull(form.nextAction),
        nextActionAt: dateInputToUnixMs(form.nextActionAt),
        notes: emptyToNull(form.notes),
      });
      setForm(formFromApplication(updated));
      setArchived(updated.archived);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not save application.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleArchivedChange(next: boolean) {
    const previous = archived;
    setArchived(next);
    setFormError(null);
    setIsPending(true);
    try {
      await archiveApplication(application.id, next);
    } catch (error) {
      setArchived(previous);
      setFormError(
        error instanceof Error
          ? error.message
          : next
            ? "Could not archive application."
            : "Could not unarchive application.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${application.company} — ${application.role}? This cannot be undone.`,
    );
    if (!confirmed) return;
    setIsPending(true);
    setFormError(null);
    try {
      await deleteApplication(application.id);
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Could not delete application.",
      );
      setIsPending(false);
    }
  }

  return (
    <SheetContent
      side="right"
      className="bg-background p-0 text-foreground sm:max-w-md"
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={handleSave}>
        <SheetHeader className="border-b">
          <SheetTitle className="pr-8">
            {form.company.trim() || application.company} —{" "}
            {form.role.trim() || application.role}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{STAGE_LABELS[form.stage]}</Badge>
            Edit this application.
            {application.notionPageId ? (
              <a
                href={notionPageUrl(application.notionPageId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs underline underline-offset-3"
              >
                Open in Notion
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-4 py-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sheet-company">Company</Label>
            <Input
              id="sheet-company"
              name="company"
              autoComplete="organization"
              value={form.company}
              aria-invalid={Boolean(errors.company)}
              disabled={isPending}
              onChange={(event) => {
                patch("company", event.target.value);
                if (errors.company) {
                  setErrors((current) => ({ ...current, company: undefined }));
                }
              }}
            />
            {errors.company ? (
              <p className="text-xs text-destructive">{errors.company}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sheet-role">Role</Label>
            <Input
              id="sheet-role"
              name="role"
              autoComplete="off"
              value={form.role}
              aria-invalid={Boolean(errors.role)}
              disabled={isPending}
              onChange={(event) => {
                patch("role", event.target.value);
                if (errors.role) {
                  setErrors((current) => ({ ...current, role: undefined }));
                }
              }}
            />
            {errors.role ? (
              <p className="text-xs text-destructive">{errors.role}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-stage">Stage</Label>
              <Select
                value={form.stage}
                onValueChange={(value) => patch("stage", value as Stage)}
                disabled={isPending}
              >
                <SelectTrigger id="sheet-stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  {STAGES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {STAGE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-source">Source</Label>
              <Select
                value={form.source}
                onValueChange={(value) => {
                  patch(
                    "source",
                    value === SOURCE_UNSET ? SOURCE_UNSET : (value as Source),
                  );
                }}
                disabled={isPending}
              >
                <SelectTrigger id="sheet-source" className="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value={SOURCE_UNSET}>Not specified</SelectItem>
                  {SOURCES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {SOURCE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sheet-job-url">Job URL</Label>
            <div className="flex gap-2">
              <Input
                id="sheet-job-url"
                name="jobUrl"
                inputMode="url"
                placeholder="https://"
                value={form.jobUrl}
                disabled={isPending}
                onChange={(event) => patch("jobUrl", event.target.value)}
              />
              {jobHref ? (
                <Button variant="outline" size="icon" asChild>
                  <a
                    href={jobHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open job posting"
                  >
                    <ExternalLink />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-location">Location</Label>
              <Input
                id="sheet-location"
                name="location"
                value={form.location}
                disabled={isPending}
                onChange={(event) => patch("location", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-resume-label">Resume</Label>
              <Input
                id="sheet-resume-label"
                name="resumeLabel"
                placeholder="backend-v3"
                value={form.resumeLabel}
                disabled={isPending}
                onChange={(event) => patch("resumeLabel", event.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-applied-at">Applied</Label>
              <Input
                id="sheet-applied-at"
                name="appliedAt"
                type="date"
                value={form.appliedAt}
                disabled={isPending}
                onChange={(event) => patch("appliedAt", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sheet-apply-by">Apply by</Label>
              <Input
                id="sheet-apply-by"
                name="applyBy"
                type="date"
                value={form.applyBy}
                disabled={isPending}
                onChange={(event) => patch("applyBy", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sheet-next-action">Next action</Label>
            <Input
              id="sheet-next-action"
              name="nextAction"
              value={form.nextAction}
              disabled={isPending}
              onChange={(event) => patch("nextAction", event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sheet-next-action-at">Next action date</Label>
            <Input
              id="sheet-next-action-at"
              name="nextActionAt"
              type="date"
              value={form.nextActionAt}
              disabled={isPending}
              onChange={(event) => patch("nextActionAt", event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sheet-notes">Notes</Label>
            <Textarea
              id="sheet-notes"
              name="notes"
              value={form.notes}
              disabled={isPending}
              className="min-h-20"
              onChange={(event) => patch("notes", event.target.value)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-2.5 py-2">
            <div className="grid gap-0.5">
              <Label htmlFor="sheet-archived">Archived</Label>
              <p className="text-xs text-muted-foreground">
                Hidden from the board by default
              </p>
            </div>
            <Switch
              id="sheet-archived"
              checked={archived}
              disabled={isPending}
              onCheckedChange={(checked) => {
                void handleArchivedChange(checked);
              }}
            />
          </div>
          {formError ? (
            <p className="text-xs text-destructive">{formError}</p>
          ) : null}
        </div>
        <SheetFooter className="flex-row justify-between border-t">
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              void handleDelete();
            }}
          >
            Delete
          </Button>
          <Button type="submit" disabled={isPending}>
            Save
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  );
}
