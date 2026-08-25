import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import {
  archiveApplication,
  deleteApplication,
  getApplication,
  listApplications,
  listNeedsAttention,
  moveApplication,
  searchApplications,
  updateApplication,
  upsertApplication,
  upsertApplications,
} from "../lib/applications";
import { isNotionEnabled } from "../lib/notion/config";
import { reconcileAll } from "../lib/notion/sync";
import { SOURCES, STAGES } from "../lib/types";

const stageSchema = z.enum(STAGES);
const sourceSchema = z.enum(SOURCES);

const upsertInputShape = {
  company: z.string().min(1).describe("Company name. Required."),
  role: z.string().min(1).describe("Job title / role. Required."),
  stage: stageSchema
    .optional()
    .describe(
      "Pipeline stage. One of: wishlist, applied, screening, interview, offer, rejected, withdrawn.",
    ),
  source: sourceSchema
    .nullable()
    .optional()
    .describe(
      "How the job was found. One of: linkedin, company_site, referral, recruiter, other. Null if unknown.",
    ),
  jobUrl: z.string().nullable().optional().describe("Job posting URL."),
  location: z.string().nullable().optional().describe("Job location."),
  resumeLabel: z
    .string()
    .nullable()
    .optional()
    .describe("Label for the resume variant used."),
  notes: z.string().nullable().optional().describe("Free-form notes."),
  nextAction: z
    .string()
    .nullable()
    .optional()
    .describe("Next action the candidate should take."),
  appliedAt: z
    .number()
    .nullable()
    .optional()
    .describe("Unix timestamp in milliseconds when the application was submitted."),
  applyBy: z
    .number()
    .nullable()
    .optional()
    .describe("Unix timestamp in milliseconds deadline to apply."),
  nextActionAt: z
    .number()
    .nullable()
    .optional()
    .describe("Unix timestamp in milliseconds when the next action is due."),
  archived: z.boolean().optional().describe("Whether the application is archived."),
};

const upsertInputSchema = z.object(upsertInputShape);

function jsonResult(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

function run(fn: () => unknown) {
  try {
    return jsonResult(fn());
  } catch (err) {
    return toolError(err);
  }
}

function requireApplication(id: string) {
  const application = getApplication(id);
  if (!application) {
    throw new Error(`Application not found: ${id}`);
  }
  return application;
}

const server = new McpServer({ name: "job-tracker", version: "0.1.0" });

server.registerTool(
  "search_applications",
  {
    description:
      "Search existing job applications by free-text query (company, role, notes, location, URL). Always call this before upsert_application to detect duplicates.",
    inputSchema: {
      q: z.string().min(1).describe("Free-text search query."),
    },
  },
  async ({ q }) => run(() => searchApplications(q)),
);

server.registerTool(
  "list_applications",
  {
    description:
      "List job applications with optional filters. Use q for text search, stage for pipeline stage, archived for archive state, needsAttention for items that need follow-up. Prefer search_applications when looking up a specific company/role before create.",
    inputSchema: {
      q: z.string().optional().describe("Optional free-text search query."),
      stage: stageSchema
        .optional()
        .describe(
          "Optional pipeline stage filter: wishlist, applied, screening, interview, offer, rejected, withdrawn.",
        ),
      archived: z
        .boolean()
        .optional()
        .describe("Optional archive filter. true = archived only, false = active only."),
      needsAttention: z
        .boolean()
        .optional()
        .describe("When true, only applications that need attention."),
    },
  },
  async (query) => run(() => listApplications(query)),
);

server.registerTool(
  "list_needs_attention",
  {
    description:
      "List applications that need attention (stale, missing next action, upcoming apply-by). No arguments.",
  },
  async () => run(() => listNeedsAttention()),
);

server.registerTool(
  "get_application",
  {
    description:
      "Fetch one application by id. Returns the full record. Errors if the id does not exist.",
    inputSchema: {
      id: z.string().min(1).describe("Application id."),
    },
  },
  async ({ id }) => run(() => requireApplication(id)),
);

server.registerTool(
  "upsert_application",
  {
    description:
      "Create or update a job application. company and role are required. Call search_applications first to avoid duplicates. Optional timestamps are unix milliseconds. Returns { application, created, duplicates }.",
    inputSchema: upsertInputShape,
  },
  async (input) => run(() => upsertApplication(input)),
);

server.registerTool(
  "upsert_applications",
  {
    description:
      "Bulk upsert job applications. Each item matches upsert_application (company and role required). Maximum 50 items. Returns an array of { application, created, duplicates }.",
    inputSchema: {
      items: z
        .array(upsertInputSchema)
        .min(1)
        .max(50)
        .describe("Applications to upsert. Maximum 50."),
    },
  },
  async ({ items }) => run(() => upsertApplications(items)),
);

server.registerTool(
  "update_application",
  {
    description:
      "Partially update an existing application by id. Omit fields that should remain unchanged. Optional timestamps are unix milliseconds. Errors if the id does not exist.",
    inputSchema: {
      id: z.string().min(1).describe("Application id."),
      company: z.string().min(1).optional().describe("Company name."),
      role: z.string().min(1).optional().describe("Job title / role."),
      stage: upsertInputShape.stage,
      source: upsertInputShape.source,
      jobUrl: upsertInputShape.jobUrl,
      location: upsertInputShape.location,
      resumeLabel: upsertInputShape.resumeLabel,
      notes: upsertInputShape.notes,
      nextAction: upsertInputShape.nextAction,
      appliedAt: upsertInputShape.appliedAt,
      applyBy: upsertInputShape.applyBy,
      nextActionAt: upsertInputShape.nextActionAt,
      archived: upsertInputShape.archived,
    },
  },
  async ({ id, ...input }) => run(() => updateApplication(id, input)),
);

server.registerTool(
  "move_application",
  {
    description:
      "Move an application to a new pipeline stage. stage must be one of: wishlist, applied, screening, interview, offer, rejected, withdrawn.",
    inputSchema: {
      id: z.string().min(1).describe("Application id."),
      stage: stageSchema.describe("Target pipeline stage."),
    },
  },
  async ({ id, stage }) => run(() => moveApplication(id, stage)),
);

server.registerTool(
  "archive_application",
  {
    description:
      "Archive or unarchive an application. archived defaults to true. Pass false to unarchive.",
    inputSchema: {
      id: z.string().min(1).describe("Application id."),
      archived: z
        .boolean()
        .optional()
        .describe("true to archive (default), false to unarchive."),
    },
  },
  async ({ id, archived }) =>
    run(() => archiveApplication(id, archived ?? true)),
);

server.registerTool(
  "delete_application",
  {
    description:
      "Permanently delete an application by id. This cannot be undone. Errors if the id does not exist.",
    inputSchema: {
      id: z.string().min(1).describe("Application id."),
    },
  },
  async ({ id }) =>
    run(() => {
      deleteApplication(id);
      return { ok: true, id };
    }),
);

server.registerTool(
  "sync_notion",
  {
    description:
      "Two-way sync with Notion when connected (token + database ID in the board UI or env). No-op report if Notion is not connected. Pushes local writes and pulls remote edits.",
  },
  async () => {
    try {
      if (!isNotionEnabled()) {
        return jsonResult({
          enabled: false,
          error: "Notion is not connected.",
        });
      }
      return jsonResult(await reconcileAll());
    } catch (err) {
      return toolError(err);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
