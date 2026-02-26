export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="p-6 text-center">
      <h1 className="text-2xl font-bold mb-2">Authentication Disabled</h1>
      <p className="text-gray-600 mb-6">
        This application does not use sign-in or user accounts.
      </p>

      <a
        href="/courses"
        className="px-4 py-2 bg-blue-600 text-white rounded inline-block"
      >
        Go to Courses
      </a>
    </div>
  );
}
