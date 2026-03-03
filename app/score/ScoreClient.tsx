"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

// Types
type Player = { id: string; player_name: string };
type ScoreMap = { [playerId: string]: { [hole: number]: number | undefined } };

type TeeRow = {
  id: string;
  tee_name: string;
  par: number[];
  stroke_index: number[];
  yardage: number[];
  metres: number[];
};

const DEFAULT_STROKES = 5;

export default function ScoreClient() {
  const sp = useSearchParams();
  const competitionId = sp.get("competition_id");

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [scores, setScores] = useState<ScoreMap>({});
  const [tee, setTee] = useState<TeeRow | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Derived hole info
  const holePar = tee?.par?.[currentHole - 1] ?? null;
  const holeSI = tee?.stroke_index?.[currentHole - 1] ?? null;
  const holeYards = tee?.yardage?.[currentHole - 1] ?? null;
  const holeMetres = tee?.metres?.[currentHole - 1] ?? null;

  // Header title
  const holeTitle = useMemo(() => {
    if (holeSI != null) return `HOLE ${currentHole} • PAR ${holePar}`;
    return `HOLE ${currentHole}`;
  }, [currentHole, holePar, holeSI]);

  // Load competition → tee → hole data
  useEffect(() => {
    if (!competitionId) return;

    (async () => {
      // Load players
      const { data: playersData } = await supabase
        .from("players")
        .select("id, player_name")
        .eq("competition_id", competitionId)
        .order("created_at");
      setPlayers(playersData ?? []);

      // Load scores
      const { data: scoreData } = await supabase
        .from("score_entries")
        .select("player_id, hole_number, strokes")
        .eq("competition_id", competitionId);

      const map: ScoreMap = {};
      (scoreData ?? []).forEach((r: any) => {
        if (!map[r.player_id]) map[r.player_id] = {};
        map[r.player_id][r.hole_number] = r.strokes ?? undefined;
      });
      setScores(map);

      // Load competition → tee_id
      const { data: compRow } = await supabase
        .from("competitions")
        .select("tee_id")
        .eq("id", competitionId)
        .single();

      if (!compRow?.tee_id) return;

      // Load tee arrays
      const { data: teeRow } = await supabase
        .from("tees")
        .select("id, tee_name, par, stroke_index, yardage, metres")
        .eq("id", compRow.tee_id)
        .single();

      if (teeRow) setTee(teeRow as TeeRow);
    })();
  }, [competitionId]);

  // Navigation
  function nextHole() {
    setCurrentHole((h) => (h % 18) + 1);
  }
  function prevHole() {
    setCurrentHole((h) => ((h - 2 + 18) % 18) + 1);
  }

  // Set stroke manually
  function setStroke(playerId: string, value: string) {
    const n = value.trim() === "" ? undefined : Number(value);
    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [currentHole]: n,
      },
    }));
  }

  // + / – buttons
  function adjustStroke(playerId: string, delta: number) {
    const current = scores[playerId]?.[currentHole];
    const next = Math.max(1, (current ?? DEFAULT_STROKES) + delta);

    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [currentHole]: next,
      },
    }));
  }

  // Save hole
  async function saveHole() {
    if (!competitionId) return;

    const payloads = players.map((p) => {
      const val = scores[p.id]?.[currentHole];
      return {
        player_id: p.id,
        strokes: val ?? DEFAULT_STROKES,
      };
    });

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
      <div className="p-4 text-red-600">
        Missing competition id. Please start from the Players page.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">

      {/* PREMIUM HOLE HEADER CARD */}
      <div className="bg-white rounded-lg shadow p-5 text-center border">
        <h2 className="text-4xl font-extrabold uppercase tracking-wide">
          {holeTitle}
        </h2>

        {/* Stroke Index */}
        {holeSI != null && (
          <p className="text-lg font-semibold mt-1">
            Stroke Index: {holeSI}
          </p>
        )}

        {/* Tee Name (uppercase) */}
        {tee && (
          <p className="mt-2 text-gray-700 font-semibold uppercase">
            {tee.tee_name} TEE
          </p>
        )}

        {/* Yardage + Metres */}
        {holeYards != null && holeMetres != null && (
          <p className="text-sm text-gray-600 mt-1">
            {holeYards} yds / {holeMetres} m
          </p>
        )}
      </div>

      {/* Prev / Next / Finish */}
      <div className="flex items-center justify-between bg-white p-3 rounded shadow">
        <button onClick={handlePrev} className="px-3 py-2 bg-gray-200 rounded">
          Prev
        </button>

        <div />

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

      {/* Leaderboard links */}
      <div className="flex gap-2">
        <Link
          href={`/leaderboard?competition_id=${competitionId}`}
          target="_blank"
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          Open Leaderboard
        </Link>

        <Link
          href={`/leaderboard-tv?competition_id=${competitionId}`}
          target="_blank"
          className="px-3 py-2 bg-gray-800 text-white rounded"
        >
          Open TV Leaderboard
        </Link>
      </div>

      {/* Column headings */}
      <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700 px-1">
        <div className="col-span-7">Player Name</div>
        <div className="col-span-5 text-right">Strokes on Hole</div>
      </div>

      {/* Player rows */}
      <div className="space-y-2">
        {players.map((p) => {
          const val = scores[p.id]?.[currentHole];
          const display = (val ?? DEFAULT_STROKES).toString();

          return (
            <div
              key={p.id}
              className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded shadow"
            >
              {/* Player Name */}
              <div className="col-span-7 font-medium">{p.player_name}</div>

              {/* Strokes UI */}
              <div className="col-span-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="h-10 w-10 rounded bg-gray-200 text-xl leading-none"
                  onClick={() => adjustStroke(p.id, -1)}
                >
                  –
                </button>

                <input
                  className="w-20 text-center p-2 border rounded"
                  inputMode="numeric"
                  value={display}
                  onChange={(e) => setStroke(p.id, e.target.value)}
                />

                <button
                  type="button"
                  className="h-10 w-10 rounded
 bg-gray-200 text-xl leading-none"
                  onClick={() => adjustStroke(p.id, +1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Finish Confirmation Modal */}
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
