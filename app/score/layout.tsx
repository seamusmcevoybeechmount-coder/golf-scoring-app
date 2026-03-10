"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React from "react";
import "../globals.css";

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  const sp = useSearchParams();
  const hole = Number(sp.get("hole") || "1");
  const safeHole = Number.isFinite(hole) && hole >= 1 && hole <= 18 ? hole : 1;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {/* Top navigation with HOLE X centered */}
        <nav className="flex items-center justify-between gap-4 p-4 bg-white border-b shadow-sm sticky top-0 z-10">
          <div className="flex-1">
            <Link href="/" className="font-medium hover:underline">
              Golf Scoring
            </Link>
          </div>

          <div className="flex-0">
            <span className="text-lg font-semibold uppercase tracking-wide">
              HOLE {safeHole}
            </span>
          </div>

          <div className="flex-1 text-right space-x-4">
            <Link href="/courses" className="font-medium hover:underline">
              Courses
            </Link>
            <Link href="/leaderboard" className="font-medium hover:underline">
              Leaderboard
            </Link>
          </div>
        </nav>

        <main className="p-4">{children}</main>
      </body>
    </html>
  );
}
