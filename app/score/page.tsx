import { Suspense } from "react";
import ScoreClient from "./ScoreClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading scoring…</div>}>
      <ScoreClient />
    </Suspense>
  );
}
