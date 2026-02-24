import { Suspense } from "react";
import LeaderboardClient from "./LeaderboardClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading leaderboard…</div>}>
      <LeaderboardClient />
    </Suspense>
  );
}
