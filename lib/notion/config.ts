import { getSetting } from "../settings";
import type { NotionCredentialSource, NotionPublicSettings } from "../types";
import { maskNotionToken, parseNotionDatabaseId } from "./map";

export const SETTING_TOKEN = "notion_token";
export const SETTING_DATABASE_ID = "notion_database_id";
export const SETTING_LAST_SYNCED_AT = "notion_last_synced_at";
export const SETTING_LAST_SYNC_ERROR = "notion_last_sync_error";

export type NotionCredentials = {
  token: string;
  databaseId: string;
  source: NotionCredentialSource;
};

function envToken(): string | null {
  const value = process.env.NOTION_TOKEN?.trim();
  return value ? value : null;
}

function envDatabaseId(): string | null {
  const value = process.env.NOTION_DATABASE_ID?.trim();
  if (!value) return null;
  try {
    return parseNotionDatabaseId(value);
  } catch {
    return value;
  }
}

export function getNotionCredentials(): NotionCredentials | null {
  const tokenFromEnv = envToken();
  const databaseFromEnv = envDatabaseId();
  if (tokenFromEnv && databaseFromEnv) {
    return {
      token: tokenFromEnv,
      databaseId: databaseFromEnv,
      source: "env",
    };
  }

  const token = getSetting(SETTING_TOKEN);
  const databaseId = getSetting(SETTING_DATABASE_ID);
  if (token && databaseId) {
    return { token, databaseId, source: "settings" };
  }
  return null;
}

export function isNotionEnabled(): boolean {
  return getNotionCredentials() !== null;
}

export function getNotionPublicSettings(): NotionPublicSettings {
  const credentials = getNotionCredentials();
  if (!credentials) {
    return {
      enabled: false,
      source: null,
      tokenMasked: null,
      databaseId: null,
    };
  }
  return {
    enabled: true,
    source: credentials.source,
    tokenMasked: maskNotionToken(credentials.token),
    databaseId: credentials.databaseId,
  };
}
