import { listApplications } from "@/lib/applications";
import { BoardApp } from "@/app/board-app";

export const dynamic = "force-dynamic";

export default function Home() {
  const applications = listApplications({ archived: false });
  const archivedApplications = listApplications({ archived: true });

  return (
    <BoardApp
      applications={applications}
      archivedApplications={archivedApplications}
    />
  );
}
