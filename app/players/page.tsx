import { Suspense } from "react";
import PlayersClient from "./PlayersClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { course_id?: string };
}) {
  if (!searchParams?.course_id) {
    redirect("/courses");
  }
  return (
    <Suspense fallback={<div>Loading players…</div>}>
      <PlayersClient />
    </Suspense>
  );
}
