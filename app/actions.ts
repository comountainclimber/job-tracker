"use server";

import {
  archiveApplication as archiveApplicationRecord,
  deleteApplication as deleteApplicationRecord,
  getApplication as getApplicationRecord,
  listApplications as listApplicationsRecord,
  listNeedsAttention as listNeedsAttentionRecord,
  moveApplication as moveApplicationRecord,
  searchApplications as searchApplicationsRecord,
  updateApplication as updateApplicationRecord,
  upsertApplication as upsertApplicationRecord,
} from "@/lib/applications";
import type {
  Application,
  ListApplicationsQuery,
  Stage,
  UpdateInput,
  UpsertInput,
  UpsertResult,
} from "@/lib/types";
import { revalidatePath } from "next/cache";

function refresh() {
  revalidatePath("/");
}

export async function listApplications(
  query?: ListApplicationsQuery,
): Promise<Application[]> {
  return listApplicationsRecord(query);
}

export async function getApplication(
  id: string,
): Promise<Application | null> {
  return getApplicationRecord(id);
}

export async function searchApplications(q: string): Promise<Application[]> {
  return searchApplicationsRecord(q);
}

export async function upsertApplication(
  input: UpsertInput,
): Promise<UpsertResult> {
  const result = upsertApplicationRecord(input);
  refresh();
  return result;
}

export async function updateApplication(
  id: string,
  input: UpdateInput,
): Promise<Application> {
  const application = updateApplicationRecord(id, input);
  refresh();
  return application;
}

export async function moveApplication(
  id: string,
  stage: Stage,
): Promise<Application> {
  const application = moveApplicationRecord(id, stage);
  refresh();
  return application;
}

export async function archiveApplication(
  id: string,
  archived = true,
): Promise<Application> {
  const application = archiveApplicationRecord(id, archived);
  refresh();
  return application;
}

export async function deleteApplication(id: string): Promise<void> {
  deleteApplicationRecord(id);
  refresh();
}

export async function listNeedsAttention(): Promise<Application[]> {
  return listNeedsAttentionRecord();
}
