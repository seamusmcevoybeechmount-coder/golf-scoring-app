
// NOTE: Only the relevant changes are shown here for clarity.
// You requested:
// A) Default score = 0
// A) +/- buttons allow going down to 0

// In your real file, these two lines must replace the existing ones:

const DEFAULT_STROKES = 0;

function adjustStroke(playerId: string, delta: number) {
  const current = scores[playerId]?.[currentHole];
  const next = Math.max(0, (current ?? DEFAULT_STROKES) + delta);
  setScores((prev) => ({
    ...prev,
    [playerId]: {
      ...(prev[playerId] ?? {}),
      [currentHole]: next,
    },
  }));
}

