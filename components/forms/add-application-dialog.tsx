"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  searchApplications,
  upsertApplication,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Application, Source, Stage } from "@/lib/types";
import {
  SOURCE_LABELS,
  SOURCES,
  STAGE_LABELS,
  STAGES,
} from "@/lib/types";

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

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isCompanyRoleDuplicate(
  apps: Application[],
  company: string,
  role: string,
): boolean {
  const companyKey = company.trim().toLowerCase();
  const roleKey = role.trim().toLowerCase();
  return apps.some(
    (app) =>
      app.company.trim().toLowerCase() === companyKey &&
      app.role.trim().toLowerCase() === roleKey,
  );
}

export function AddApplicationDialog(props?: { children?: ReactNode }) {
  const children = props?.children;
  const companyRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [source, setSource] = useState<Source | typeof SOURCE_UNSET>(
    SOURCE_UNSET,
  );
  const [stage, setStage] = useState<Stage>("wishlist");
  const [appliedAt, setAppliedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ company?: string; role?: string }>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function resetForm() {
    setCompany("");
    setRole("");
    setJobUrl("");
    setSource(SOURCE_UNSET);
    setStage("wishlist");
    setAppliedAt("");
    setNotes("");
    setErrors({});
    setDuplicateWarning(null);
    setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  async function refreshDuplicateWarning(nextCompany: string, nextRole: string) {
    const trimmedCompany = nextCompany.trim();
    const trimmedRole = nextRole.trim();
    if (!trimmedCompany || !trimmedRole) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const matches = await searchApplications(trimmedCompany);
      if (isCompanyRoleDuplicate(matches, trimmedCompany, trimmedRole)) {
        setDuplicateWarning(
          "An application for this company and role already exists. You can still save.",
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // Search is advisory; never block the form.
    }
  }

  async function handleSubmit(addAnother: boolean) {
    const trimmedCompany = company.trim();
    const trimmedRole = role.trim();
    const nextErrors: { company?: string; role?: string } = {};
    if (!trimmedCompany) nextErrors.company = "Company is required.";
    if (!trimmedRole) nextErrors.role = "Role is required.";
    setErrors(nextErrors);
    setSubmitError(null);
    if (!trimmedCompany || !trimmedRole) return;

    setIsPending(true);
    try {
      try {
        const matches = await searchApplications(trimmedCompany);
        if (isCompanyRoleDuplicate(matches, trimmedCompany, trimmedRole)) {
          setDuplicateWarning(
            "An application for this company and role already exists. You can still save.",
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch {
        // Duplicate search is advisory and must not block save.
      }

      await upsertApplication({
        company: trimmedCompany,
        role: trimmedRole,
        stage,
        jobUrl: emptyToNull(jobUrl),
        source: source === SOURCE_UNSET ? null : source,
        appliedAt: dateInputToUnixMs(appliedAt),
        notes: emptyToNull(notes),
      });

      if (addAnother) {
        resetForm();
        requestAnimationFrame(() => {
          companyRef.current?.focus();
        });
        return;
      } else {
        handleOpenChange(false);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not save application.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children ?? <Button type="button">Add application</Button>}
      </DialogTrigger>
      <DialogContent className="bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>
            Company and role are required. Everything else is optional.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(false);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="add-company">Company</Label>
            <Input
              ref={companyRef}
              id="add-company"
              name="company"
              autoComplete="organization"
              value={company}
              aria-invalid={Boolean(errors.company)}
              disabled={isPending}
              onChange={(event) => {
                setCompany(event.target.value);
                if (errors.company) {
                  setErrors((current) => ({ ...current, company: undefined }));
                }
              }}
              onBlur={() => {
                void refreshDuplicateWarning(company, role);
              }}
            />
            {errors.company ? (
              <p className="text-xs text-destructive">{errors.company}</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="add-role">Role</Label>
            <Input
              id="add-role"
              name="role"
              autoComplete="off"
              value={role}
              aria-invalid={Boolean(errors.role)}
              disabled={isPending}
              onChange={(event) => {
                setRole(event.target.value);
                if (errors.role) {
                  setErrors((current) => ({ ...current, role: undefined }));
                }
              }}
              onBlur={() => {
                void refreshDuplicateWarning(company, role);
              }}
            />
            {errors.role ? (
              <p className="text-xs text-destructive">{errors.role}</p>
            ) : null}
          </div>
          {duplicateWarning ? (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-2 text-xs">
              <Badge variant="outline">Duplicate</Badge>
              <p className="text-muted-foreground">{duplicateWarning}</p>
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="add-job-url">Job URL</Label>
            <Input
              id="add-job-url"
              name="jobUrl"
              inputMode="url"
              placeholder="https://"
              value={jobUrl}
              disabled={isPending}
              onChange={(event) => setJobUrl(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="add-source">Source</Label>
              <Select
                value={source}
                onValueChange={(value) => {
                  setSource(value === SOURCE_UNSET ? SOURCE_UNSET : (value as Source));
                }}
                disabled={isPending}
              >
                <SelectTrigger id="add-source" className="w-full">
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
            <div className="grid gap-1.5">
              <Label htmlFor="add-stage">Stage</Label>
              <Select
                value={stage}
                onValueChange={(value) => setStage(value as Stage)}
                disabled={isPending}
              >
                <SelectTrigger id="add-stage" className="w-full">
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
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="add-applied-at">Applied date</Label>
            <Input
              id="add-applied-at"
              name="appliedAt"
              type="date"
              value={appliedAt}
              disabled={isPending}
              onChange={(event) => setAppliedAt(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="add-notes">Notes</Label>
            <Textarea
              id="add-notes"
              name="notes"
              value={notes}
              disabled={isPending}
              className="min-h-20"
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          {submitError ? (
            <p className="text-xs text-destructive">{submitError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                void handleSubmit(true);
              }}
            >
              Save and add another
            </Button>
            <Button type="submit" disabled={isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
