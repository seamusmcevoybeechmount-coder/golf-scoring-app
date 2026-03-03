// app/page.tsx
export default function Page() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Golf Scoring App</h1>
      <p className="text-gray-700">Pick a course to get started.</p>
      <div className="flex gap-3">
        <a className="px-4 py-2 rounded bg-blue-600 text-white" href="/courses">Go to Courses</a>
        <a className="px-4 py-2 rounded bg-gray-200" href="/leaderboard">View Leaderboard</a>
      </div>
    </main>
  );
}
