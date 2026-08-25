"use client";

import { useEffect, useState } from "react";
import {
  disconnectNotion,
  getNotionSettings,
  saveNotionSettings,
} from "@/app/actions";
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
import type { NotionPublicSettings } from "@/lib/types";

export function NotionSettingsDialog({
  initial,
}: {
  initial: NotionPublicSettings;
}) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(initial);
  const [token, setToken] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const fromEnv = settings.source === "env";

  useEffect(() => {
    if (!open) return;
    void getNotionSettings()
      .then((next) => {
        setSettings(next);
        setDatabaseId(next.source === "env" ? (next.databaseId ?? "") : "");
        setToken("");
        setError(null);
      })
      .catch(() => {
        // Keep the last known settings if refresh fails.
      });
  }, [open]);

  async function handleConnect() {
    setIsPending(true);
    setError(null);
    try {
      const next = await saveNotionSettings({ token, databaseId });
      setSettings(next);
      setToken("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to Notion.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleDisconnect() {
    setIsPending(true);
    setError(null);
    try {
      const next = await disconnectNotion();
      setSettings(next);
      setToken("");
      setDatabaseId("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not disconnect Notion.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Notion
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background text-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notion sync</DialogTitle>
          <DialogDescription>
            Optional. The board stays local; Notion is a two-way mirror when
            connected.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid list-decimal gap-2 pl-4 text-sm text-muted-foreground">
          <li>
            Open{" "}
            <a
              href="https://www.notion.so/my-integrations"
              target="_blank"
              rel="noopener noreferrer"
            >
              Create an integration
            </a>{" "}
            → <span className="text-foreground">New integration</span> → type{" "}
            <span className="text-foreground">Internal</span> → copy the{" "}
            <span className="text-foreground">Internal Integration Secret</span>
            .
          </li>
          <li>In Notion, create a full-page database (or open an existing one).</li>
          <li>
            Share it with the integration: database{" "}
            <span className="text-foreground">•••</span> →{" "}
            <span className="text-foreground">Connections</span> → select the
            integration. Skip this and the API returns 404.
          </li>
          <li>
            Copy the database ID from the URL (
            <span className="text-foreground">32 hex characters</span> before{" "}
            <span className="font-mono">?v=</span>) or paste the whole URL.
          </li>
          <li>Paste the token and database ID below, then Connect.</li>
        </ol>
        {settings.enabled ? (
          <div className="rounded-lg border border-border px-3 py-2 text-xs">
            <p>
              Connected{fromEnv ? " via environment" : ""}
              {settings.tokenMasked ? ` · ${settings.tokenMasked}` : ""}
            </p>
            {settings.databaseId ? (
              <p className="mt-1 font-mono text-muted-foreground">
                {settings.databaseId}
              </p>
            ) : null}
          </div>
        ) : null}
        {fromEnv ? (
          <p className="text-xs text-muted-foreground">
            Credentials come from{" "}
            <span className="font-mono">NOTION_TOKEN</span> and{" "}
            <span className="font-mono">NOTION_DATABASE_ID</span>. Disconnect
            from the UI is disabled until those env vars are removed.
          </p>
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleConnect();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="notion-token">Integration token</Label>
              <Input
                id="notion-token"
                name="token"
                type="password"
                autoComplete="off"
                placeholder={settings.tokenMasked ?? "secret_… or ntn_…"}
                value={token}
                disabled={isPending}
                onChange={(event) => setToken(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notion-database-id">Database ID or URL</Label>
              <Input
                id="notion-database-id"
                name="databaseId"
                autoComplete="off"
                placeholder="https://www.notion.so/… or 32-character id"
                value={databaseId}
                disabled={isPending}
                onChange={(event) => setDatabaseId(event.target.value)}
              />
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <DialogFooter className="px-0">
              {settings.enabled ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    void handleDisconnect();
                  }}
                >
                  Disconnect
                </Button>
              ) : null}
              <Button type="submit" disabled={isPending}>
                Connect
              </Button>
            </DialogFooter>
          </form>
        )}
        {fromEnv && error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}