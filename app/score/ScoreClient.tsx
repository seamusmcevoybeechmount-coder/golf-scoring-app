"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Player = { id: string; player_name: string };

type ScoreMap = { [playerId: string]: { [hole: number]: number | undefined } };

export default function ScoreClient() {
  const sp = useSearchParams();
  const competitionId = sp.get("competition_id");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentHole, setCurrentHole] = useState<number>(1);
  const [scores, setScores] = useState<ScoreMap>({});
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const holeLabel = useMemo(() => `HOLE ${currentHole}`, [currentHole]);

  useEffect(() => {
    if (!competitionId) return;

    (async () => {
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

  function nextHole() {
    setCurrentHole((h) => (h % 18) + 1);
  }

  function prevHole() {
    setCurrentHole((h) => ((h - 2 + 18) % 18) + 1);
  }

  function setStroke(playerId: string, value: string) {
    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [currentHole]: value ? Number(value) : undefined,
      },
    }));
  }

  async function saveHole() {
    if (!competitionId) return;

    const payloads = players
      .map((p) => {
        const strokes = scores[p.id]?.[currentHole];
        return strokes ? { player_id: p.id, strokes } : null;
      })
      .filter(Boolean) as { player_id: string; strokes: number }[];

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

  async function handleFinish() {
    await saveHole();
    setShowFinishConfirm(false);
    window.location.href = `/leaderboard?competition_id=${competitionId}`;
  }

  if (!competitionId) {
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
      {/* BIG HOLE NUMBER */}
      <div className="text-center mt-4 mb-2">
        <h2 className="text-4xl font-extrabold uppercase tracking-wide">
          {holeLabel}
        </h2>
      </div>

      {/* Prev / Next / Finish buttons */}
      <div className="flex items-center justify-between bg-white p-3 rounded shadow">
        <button onClick={handlePrev} className="px-3 py-2 bg-gray-200 rounded">
          Prev
        </button>

        <div className="font-semibold">{/* Keeping spacing centered */}</div>

        {currentHole < 18 ? (
          <button
            onClick={handleNext}
            className="px-3 py-2 bg-gray-800 text-white rounded"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => setShowFinishConfirm(true)}
            className="px-3 py-2 bg-green-600 text-white rounded"
          >
            Finish
          </button>
        )}
      </div>

      {/* Leaderboard shortcuts */}
      <div className="flex gap-2">
        <Link
          className="px-3 py-2 bg-blue-600 text-white rounded"
          href={`/leaderboard?competition_id=${competitionId}`}
          target="_blank"
        >
          Open Leaderboard
        </Link>
        <Link
          className="px-3 py-2 bg-gray-800 text-white rounded"
          href={`/leaderboard-tv?competition_id=${competitionId}`}
          target="_blank"
        >
          Open TV Leaderboard
        </Link>
      </div>

      {/* TABLE HEADINGS */}
      <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700 px-1 mt-4">
        <div className="col-span-7">Player Name</div>
        <div className="col-span-5 text-right">Strokes on Hole</div>
      </div>

      {/* PLAYER INPUT ROWS */}
      <div className="space-y-2">
        {players.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded shadow"
          >
            <div className="col-span-7 font-medium">{p.player_name}</div>

            <input
              className="col-span-5 p-2 border rounded text-right"
              inputMode="numeric"
              value={(scores[p.id]?.[currentHole] ?? "").toString()}
              onChange={(e) => setStroke(p.id, e.target.value)}
              placeholder="0"
            />
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-600">
        Strokes are saved when you click Next/Prev.  
        You can revisit any hole to edit and resave.
      </div>

      {/* FINISH CONFIRMATION MODAL */}
      {showFinishConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-xl space-y-4 max-w-sm text-center">
            <h2 className="text-xl font-bold">Finish Round?</h2>

            <p className="text-gray-700">
              Are you sure you want to finish the round?  
              You can still go back and adjust scores if needed.
            </p>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>

              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Yes, Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
