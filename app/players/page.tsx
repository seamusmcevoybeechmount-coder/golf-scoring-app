import { Suspense } from "react";
import { redirect } from "next/navigation";
import PlayersClient from "./PlayersClient";

// Render this page dynamically (no static prerender)
export const dynamic = "force-dynamic";

// Next.js App Router passes `searchParams` as a plain object where values are
// string | string[] | undefined. We define a local type to avoid mismatches.
type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function Page({ searchParams }: PageProps) {
  // Normalize possible string[] to a single string
  const courseIdParam = searchParams?.course_id;
  const courseId =
    Array.isArray(courseIdParam) ? courseIdParam[0] : courseIdParam;

  // Guard: if a user lands here without course_id, send them to /courses
  if (!courseId) {
    redirect("/courses");
  }

  // Render the client component; it will read the query string itself
  return (
    <Suspense fallback={<div>Loading players…</div>}>
      <PlayersClient />
    </Suspense>
  );
}
