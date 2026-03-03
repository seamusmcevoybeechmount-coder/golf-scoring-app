import Image from "next/image";
import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-200/50 to-white p-6">
      
      <div className="flex flex-col items-center gap-4">
        
        {/* Logo */}
        <div className="relative h-20 w-20">
          /heath-logo.png
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
          /courses
            Start Scoring
          </Link>

          /leaderboard
            View Leaderboard
          </Link>
        </div>

      </div>
    </main>
  );
}
