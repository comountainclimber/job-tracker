# Job tracker

Local kanban for job applications. The UI, HTTP API, and MCP server all write to the same SQLite file so agents can log applications and the board stays in sync.

Application data lives in `data/tracker.db` and is gitignored. The public repo is the app, not your pipeline.

## Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## MCP (agents)

Cursor is already wired via `.cursor/mcp.json`. From this repo:

```bash
pnpm mcp
```

That process talks to SQLite directly (`pnpm dev` does not need to be running). Prefer `search_applications` before `upsert_application`. Writes are idempotent on `jobUrl`.

Example tool arguments:

```json
{
  "company": "Acme",
  "role": "Staff Engineer",
  "stage": "applied",
  "jobUrl": "https://example.com/jobs/staff",
  "source": "linkedin",
  "notes": "JD: distributed systems, 8+ years."
}
```

## HTTP

With `pnpm dev` running:

```bash
curl -s http://localhost:3000/api/applications \
  -H 'content-type: application/json' \
  -d '{"company":"Acme","role":"Staff Engineer","jobUrl":"https://example.com/jobs/staff"}'
```

`POST /api/applications` upserts (same `jobUrl` updates). See `app/api/applications/` for list, bulk, move, archive, and delete.
