export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {/* No navigation bar on leaderboard pages */}
        <main>{children}</main>
      </body>
    </html>
  );
}
