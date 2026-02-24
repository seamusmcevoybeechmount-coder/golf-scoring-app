export default function Page() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Welcome</h1>
      <p>Start by selecting a course.</p>
      <a className="inline-block bg-blue-600 text-white px-4 py-2 rounded" href="/courses">Choose Course</a>
    </div>
  );
}
