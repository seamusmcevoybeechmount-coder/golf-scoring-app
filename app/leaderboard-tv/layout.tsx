export default function LeaderboardTVLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {/* No navigation bar on TV leaderboard page */}
        <main>{children}</main>
      </body>
    </html>
  );
}
