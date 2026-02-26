import "./globals.css";

export const metadata = {
  title: "Golf Scoring App",
  description: "Mobile scoring with live leaderboards (Supabase + Next.js)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-screen-md mx-auto min-h-screen p-4">
          <header className="flex items-center justify-between py-2">
            <a href="/" className="text-xl font-semibold">Golf Scoring</a>
            <nav className="text-sm space-x-3">
              <a className="hover:underline" href="/courses">Courses</a>
              <a className="hover:underline" href="/leaderboard">Leaderboard</a>
            </nav>
          </header>

          <main className="mt-4">
            {children}   {/* THIS is the missing piece */}
          </main>
        </div>
      </body>
    </html>
  );
}
