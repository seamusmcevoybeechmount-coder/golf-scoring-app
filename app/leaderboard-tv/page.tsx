import { Suspense } from "react";
import LeaderboardTVClient from "./LeaderboardTVClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading live leaderboard…</div>}>
      <LeaderboardTVClient />
    </Suspense>
  );
}
