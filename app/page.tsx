import Image from "next/image";
import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-200/50 to-white p-6">

      <div className="flex flex-col items-center gap-4">

        {/* Logo */}
        <div className="relative h-20 w-20">
          <Image
            src="/heath-logo.png"   // <-- will work if logo is in /public/heath-logo.png
            alt="The Heath Golf Club Logo"
            fill
            className="object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 text-center">
          The Heath Golf Club
        </h1>

        <p className="text-gray-700 text-center">
          Mobile Scoring & Live Leaderboards
        </p>

        {/* Buttons */}
        <div className="flex gap-4 mt-4">

          <Link
            href="/courses"
            className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700"
          >
            Start Scoring
          </Link>

          <Link
            href="/leaderboard"
            className="px-4 py-2 bg-gray-800 text-white rounded shadow hover:bg-gray-900"
          >
            View Leaderboard
          </Link>

        </div>

      </div>

    </main>
  );
}
