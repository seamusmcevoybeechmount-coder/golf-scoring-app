import { Suspense } from "react";
import PlayersClient from "./PlayersClient";

// Render this page dynamically (no static prerender)
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">Loading players…</div>}>
      <PlayersClient />
    </Suspense>
  );
}
