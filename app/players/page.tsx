import { Suspense } from "react";
import PlayersClient from "./PlayersClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading players…</div>}>
      <PlayersClient />
    </Suspense>
  );
}
