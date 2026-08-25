import { listApplications } from "@/lib/applications";
import { BoardApp } from "@/app/board-app";
import { getNotionPublicSettings, isNotionEnabled } from "@/lib/notion/config";
import { reconcileAll } from "@/lib/notion/sync";
import { after } from "next/server";

export const dynamic = "force-dynamic";

export default function Home() {
  if (isNotionEnabled()) {
    after(() => {
      void reconcileAll();
    });
  }

  const applications = listApplications({ archived: false });
  const archivedApplications = listApplications({ archived: true });

  return (
    <BoardApp
      applications={applications}
      archivedApplications={archivedApplications}
      notion={getNotionPublicSettings()}
    />
  );
}
