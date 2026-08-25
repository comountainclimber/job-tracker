import {
  Client,
  isFullDataSource,
  type DataSourceObjectResponse,
  type UpdateDataSourceParameters,
} from "@notionhq/client";
import { SOURCES, STAGES } from "../types";
import { PROP } from "./map";

type DataSourceProperties = DataSourceObjectResponse["properties"];
type SelectOption = { id?: string; name: string; color?: string };

function selectOptions(names: readonly string[]) {
  return names.map((name) => ({ name }));
}

const EXPECTED: Record<
  string,
  | { type: "rich_text" }
  | { type: "url" }
  | { type: "date" }
  | { type: "checkbox" }
  | { type: "select"; options: { name: string }[] }
> = {
  [PROP.company]: { type: "rich_text" },
  [PROP.role]: { type: "rich_text" },
  [PROP.stage]: { type: "select", options: selectOptions(STAGES) },
  [PROP.source]: { type: "select", options: selectOptions(SOURCES) },
  [PROP.jobUrl]: { type: "url" },
  [PROP.location]: { type: "rich_text" },
  [PROP.resume]: { type: "rich_text" },
  [PROP.applied]: { type: "date" },
  [PROP.applyBy]: { type: "date" },
  [PROP.nextAction]: { type: "rich_text" },
  [PROP.nextActionAt]: { type: "date" },
  [PROP.notes]: { type: "rich_text" },
  [PROP.archived]: { type: "checkbox" },
  [PROP.trackerId]: { type: "rich_text" },
};

function toCreateProperty(spec: (typeof EXPECTED)[string]) {
  switch (spec.type) {
    case "rich_text":
      return { rich_text: {} };
    case "url":
      return { url: {} };
    case "date":
      return { date: {} };
    case "checkbox":
      return { checkbox: {} };
    case "select":
      return { select: { options: spec.options } };
  }
}

function existingSelectOptions(property: DataSourceProperties[string]): SelectOption[] {
  if (property.type !== "select") return [];
  return property.select.options.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
  }));
}

export async function ensureSchema(input: {
  client: Client;
  dataSourceId: string;
}): Promise<{ titlePropertyName: string }> {
  const dataSource = await input.client.dataSources.retrieve({
    data_source_id: input.dataSourceId,
  });
  if (!isFullDataSource(dataSource)) {
    throw new Error("Could not read the Notion data source.");
  }
  const properties = dataSource.properties;
  const titleEntry = Object.entries(properties).find(
    ([, property]) => property.type === "title",
  );
  const titlePropertyName = titleEntry?.[0] ?? "Name";

  const updates: NonNullable<UpdateDataSourceParameters["properties"]> = {};

  for (const [name, spec] of Object.entries(EXPECTED)) {
    const existing = properties[name];
    if (!existing) {
      updates[name] = toCreateProperty(spec);
      continue;
    }
    if (spec.type === "select" && existing.type === "select") {
      const have = new Set(existing.select.options.map((option) => option.name));
      const missing = spec.options.filter((option) => !have.has(option.name));
      if (missing.length > 0) {
        updates[name] = {
          select: {
            options: [...existingSelectOptions(existing), ...missing],
          },
        };
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await input.client.dataSources.update({
      data_source_id: input.dataSourceId,
      properties: updates,
    });
  }

  return { titlePropertyName };
}
