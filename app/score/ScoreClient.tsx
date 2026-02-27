"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

/** Minimal shape for players used on the scoring page */
type Player = { id: string; player_name: string };

/** scores[playerId][holeNumber] = strokes (or undefined if not set) */
type ScoreMap = { [playerId: string]: { [hole: number]: number | undefined } };

export default function ScoreClient() {
  const sp = useSearchParams();
  const competitionId = sp.get("competition_id");

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentHole, setCurrentHole] = useState<number>(1);
  const [scores, setScores] = useState<ScoreMap>({});

  // Friendly label for the current hole
  const holeLabel = useMemo(() => `Hole ${currentHole}`, [currentHole]);

  // Load players and any existing scores for this competition
  useEffect(() => {
    if (!competitionId) return;

    (async () => {
      // Load players
      const { data: playersData, error: playersErr } = await supabase
        .from("players")
        .select("id, player_name")
        .eq("competition_id", competitionId)
        .order("created_at");

      if (playersErr) {
        console.error("Failed to load players:", playersErr);
        return;
      }
      setPlayers(playersData ?? []);

      // Load existing score entries (strokes) for the competition
      const { data: entryData, error: entriesErr } = await supabase
        .from("score_entries")
        .select("player_id, hole_number, strokes")
        .eq("competition_id", competitionId);

      if (entriesErr) {
        console.error("Failed to load scores:", entriesErr);
        return;
      }

      const map: ScoreMap = {};
      (entryData ?? []).forEach((r: any) => {
        if (!map[r.player_id]) map[r.player_id] = {};
        map[r.player_id][r.hole_number] = r.strokes ?? undefined;
      });
      setScores(map);
    })();
  }, [competitionId]);

  /** Wrap to next/previous hole */
  function nextHole() {
    setCurrentHole((h) => (h % 18) + 1);
  }
  function prevHole() {
    setCurrentHole((h) => ((h - 2 + 18) % 18) + 1);
  }

  /** Update local strokes for current hole for one player */
  function setStroke(playerId: string, value: string) {
    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [currentHole]: value ? Number(value) : undefined,
      },
    }));
  }

  /** Save current hole strokes for all players that have a value */
  async function saveHole() {
    if (!competitionId) return;

    // Build a small list of entries to upsert
    const payloads = players
      .map((p) => {
        const strokes = scores[p.id]?.[currentHole];
        return strokes ? { player_id: p.id, strokes } : null;
      })
      .filter(Boolean) as { player_id: string; strokes: number }[];

    // POST each entry via the API which calls the upsert RPC (trigger calculates stableford)
    await Promise.all(
      payloads.map((rec) =>
        fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competition_id: competitionId,
            player_id: rec.player_id,
            hole_number: currentHole,
            strokes: rec.strokes,
          }),
        })
      )
    );
  }

  async function handleNext() {
    await saveHole();
    nextHole();
  }

  async function handlePrev() {
    await saveHole();
    prevHole();
  }

  if (!competitionId) {
    // If user lands here without a competition id, give a helpful message
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Scoring</h1>
        <p className="text-red-600">
          Missing competition id. Please start from the Players page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scoring</h1>

      {/* Hole navigation toolbar */}
      <div className="flex items-center justify-between bg-white p-3 rounded shadow">
        <button onClick={handlePrev} className="px-3 py-2 bg-gray-200 rounded">
          Prev
        </button>
        <div className="font-semibold">{holeLabel}</div>
        <button
          onClick={handleNext}
          className="px-3 py-2 bg-gray-800 text-white rounded"
        >
          Next
        </button>
      </div>

      {/* Buttons to open the leaderboards for this competition */}
      <div className="flex gap-2">
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
      </div>

      {/* Per-player inputs for the current hole */}
      <div className="space-y-2">
        {players.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded shadow"
          >
            <div className="col-span-7 font-medium">{p.player_name}</div>
            <input
              className="col-span-5 p-2 border rounded"
              inputMode="numeric"
              value={(scores[p.id]?.[currentHole] ?? "").toString()}
              onChange={(e) => setStroke(p.id, e.target.value)}
              placeholder="strokes"
            />
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-600">
        Strokes are saved when you click Next/Prev. You can revisit any hole to
        edit and resave.
      </div>
    </div>
  );
}
