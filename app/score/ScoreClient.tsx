"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Player = { id: string; player_name: string };
type ScoreMap = { [playerId: string]: { [hole: number]: number | undefined } };

export default function ScoreClient() {
  const sp = useSearchParams();
  const competitionId = sp.get("competition_id");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [scores, setScores] = useState<ScoreMap>({});

  // Load players and any existing scores for this competition
  useEffect(() => {
    if (!competitionId) return;
    (async () => {
      const { data: playersData } = await supabase
        .from("players")
        .select("id, player_name")
        .eq("competition_id", competitionId)
        .order("created_at");
      setPlayers(playersData ?? []);

      const { data: entryData } = await supabase
        .from("score_entries")
        .select("player_id, hole_number, strokes")
        .eq("competition_id", competitionId);

      const map: ScoreMap = {};
      (entryData ?? []).forEach((r: any) => {
        if (!map[r.player_id]) map[r.player_id] = {};
        map[r.player_id][r.hole_number] = r.strokes ?? undefined;
      });
      setScores(map);
    })();
  }, [competitionId]);

  const holeLabel = useMemo(() => `Hole ${currentHole}`, [currentHole]);

  function nextHole() {
    setCurrentHole((h) => (h % 18) + 1);
  }
  function prevHole() {
    setCurrentHole((h) => ((h - 2 + 18) % 18) + 1);
  }

  function setStroke(playerId: string, value: string) {
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), [currentHole]: value ? Number(value) : undefined },
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scoring</h1>
      {!competitionId && <p className="text-red-600">Missing competition id.</p>}

      <div className="flex items-center justify-between bg-white p-3 rounded shadow">
        <button onClick={handlePrev} className="px-3 py-2 bg-gray-200 rounded">
          Prev
        </button>
        <div className="font-semibold">{holeLabel}</div>
        <button onClick={handleNext} className="px-3 py-2 bg-gray-800 text-white rounded">
          Next
        </button>
      </div>

      <div className="space-y-2">
        {players.map((p) => (
          <div key={p.id} className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded shadow">
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

      <div className="text-sm text-gray-600">Changes are saved when you navigate Next/Prev.</div>
    </div>
  );
}
