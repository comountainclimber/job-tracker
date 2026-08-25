import {
  APIErrorCode,
  Client,
  isFullDatabase,
  isFullDataSource,
  isNotionClientError,
} from "@notionhq/client";
import { getNotionCredentials, type NotionCredentials } from "./config";

export type NotionContext = {
  client: Client;
  credentials: NotionCredentials;
  dataSourceId: string;
  titlePropertyName: string;
};

let cached: NotionContext | null = null;

export function resetNotionClient(): void {
  cached = null;
}

export function formatNotionError(err: unknown): string {
  if (isNotionClientError(err)) {
    if (err.code === APIErrorCode.Unauthorized) {
      return "Invalid integration token.";
    }
    if (err.code === APIErrorCode.ObjectNotFound) {
      return "Database not found. Share it with the integration (••• → Connections).";
    }
    if (err.code === APIErrorCode.RestrictedResource) {
      return "This integration cannot access that database. Share it via ••• → Connections.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Notion request failed.";
}

export async function getNotionContext(): Promise<NotionContext> {
  const credentials = getNotionCredentials();
  if (!credentials) {
    throw new Error("Notion is not connected.");
  }
  if (
    cached &&
    cached.credentials.token === credentials.token &&
    cached.credentials.databaseId === credentials.databaseId
  ) {
    return cached;
  }

  const client = new Client({ auth: credentials.token });
  const database = await client.databases.retrieve({
    database_id: credentials.databaseId,
  });
  if (!isFullDatabase(database)) {
    throw new Error("Could not read the Notion database.");
  }
  const dataSourceId = database.data_sources[0]?.id;
  if (!dataSourceId) {
    throw new Error("This Notion database has no data source.");
  }
  const dataSource = await client.dataSources.retrieve({
    data_source_id: dataSourceId,
  });
  if (!isFullDataSource(dataSource)) {
    throw new Error("Could not read the Notion data source.");
  }
  const titleEntry = Object.entries(dataSource.properties).find(
    ([, property]) => property.type === "title",
  );
  const titlePropertyName = titleEntry?.[0] ?? "Name";

  cached = {
    client,
    credentials,
    dataSourceId,
    titlePropertyName,
  };
  return cached;
}

export async function createNotionContext(token: string, databaseId: string) {
  const client = new Client({ auth: token });
  const database = await client.databases.retrieve({
    database_id: databaseId,
  });
  if (!isFullDatabase(database)) {
    throw new Error("Could not read the Notion database.");
  }
  const dataSourceId = database.data_sources[0]?.id;
  if (!dataSourceId) {
    throw new Error("This Notion database has no data source.");
  }
  return {
    client,
    dataSourceId,
    titlePropertyName: "Name",
  };
}
