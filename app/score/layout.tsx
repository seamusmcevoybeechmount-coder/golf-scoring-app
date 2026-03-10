"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React from "react";
import "../globals.css";

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  const sp = useSearchParams();
  const hole = Number(sp.get("hole") || "1");

  // Safety check for hole number
  const safeHole = Number.isFinite(hole) && hole >= 1 && hole <= 18 ? hole : 1;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900">

        {/* Top navigation bar */}
        <nav className="flex items-center justify-between gap-4 p-4 bg-white border-b shadow-sm sticky top-0 z-10">
          
          {/* Left: Golf Scoring */}
          <div className="flex-1">
            <Link href="/" className="font-semibold hover:underline">
              Golf Scoring
            </Link>
          </div>

          {/* Center: HOLE X */}
          <div className="flex-0">
            <span className="text-lg font-semibold uppercase tracking-wide">
              HOLE {safeHole}
            </span>
          </div>

          {/* Right: Courses + Leaderboard */}
          <div className="flex-1 text-right space-x-4">
            <Link href="/courses" className="font-semibold hover:underline">
              Courses
            </Link>

            <Link href="/leaderboard" className="font-semibold hover:underline">
              Leaderboard
            </Link>
          </div>
        </nav>

        {/* Page Content */}
        <main className="p-4">{children}</main>

      </body>
    </html>
  );
}
