import Link from "next/link";

// ...
<Link
  className="px-3 py-2 bg-blue-600 text-white rounded"
  href={`/leaderboard?competition_id=${competitionId}`}
  target="_blank"
  rel="noopener noreferrer"
>
  Open Leaderboard
</Link>

<Link
  className="px-3 py-2 bg-gray-800 text-white rounded"
  href={`/leaderboard-tv?competition_id=${competitionId}`}
  target="_blank"
  rel="noopener noreferrer"
>
  Open TV Leaderboard
</Link>
