export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold">Authentication Disabled</h1>
      <p className="mt-2 text-gray-600">
        This application does not use sign-in or user accounts.
      </p>

      <div className="mt-6">
        <a
          href="/courses"
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Go to Courses
        </a>
      </div>
    </div>
  );
}
