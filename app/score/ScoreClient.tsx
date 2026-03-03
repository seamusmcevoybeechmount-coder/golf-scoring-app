"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Player = {
  id: string;
  player_name: string;
  handicap_index: number;
  playing_handicap: number; // using WHS playing handicap directly
};

type TeeRow = {
  id: string;
  tee_name: string;
  par: number[];
  stroke_index: number[];
  yardage: number[];
  metres: number[];
  course_rating: number;
  slope_rating: number;
  course_par: number;
};

type ScoreMap = { [playerId: string]: { [hole: number]: number | undefined } };

const DEFAULT_STROKES = 5;

export default function ScoreClient() {
  const sp = useSearchParams();
  const competitionId = sp.get("competition_id");

  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [tee, setTee] = useState<TeeRow | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Derived hole meta
  const holePar = tee?.par?.[currentHole - 1] ?? null;
  const holeSI = tee?.stroke_index?.[currentHole - 1] ?? null;
  const holeYards = tee?.yardage?.[currentHole - 1] ?? null;
  const holeMetres = tee?.metres?.[currentHole - 1] ?? null;

  const holeTitle = useMemo(() => {
    if (holePar != null) return `HOLE ${currentHole} • PAR ${holePar}`;
    return `HOLE ${currentHole}`;
  }, [currentHole, holePar]);

  // Load players, scores, tee meta
  useEffect(() => {
    if (!competitionId) return;

    (async () => {
      // Load players
      const { data: playersData } = await supabase
        .from("players")
        .select("id, player_name, handicap_index, playing_handicap, tee_id")
        .eq("competition_id", competitionId)
        .order("created_at");

      setPlayers(playersData ?? []);

      // Load score entries
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

      // Get tee_id from competition
      const { data: compRow } = await supabase
        .from("competitions")
        .select("tee_id")
        .eq("id", competitionId)
        .single();

      if (!compRow?.tee_id) return;

      // Load tee metadata row
      const { data: teeRow } = await supabase
        .from("tees")
        .select(
          "id, tee_name, par, stroke_index, yardage, metres, course_rating, slope_rating, course_par"
        )
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

  // Manual set
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

  // + / –
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

  // Save strokes for a hole
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

  // -------------------------------
  // WHS STROKES RECEIVED + POINTS
  // -------------------------------

  function getShotsReceived(playingHandicap: number, si: number | null): number {
    if (si == null) return 0;

    // Standard WHS: allocate PH across SI 1..18
    if (playingHandicap <= 18) {
      // 1 shot on SI 1..PH
      return si <= playingHandicap ? 1 : 0;
    }

    // PH > 18:
    // 1 shot on all holes + 1 extra on SI 1..(PH - 18)
    const base = 1;
    const extras = playingHandicap - 18;
    return si <= extras ? base + 1 : base;
  }

  function getStablefordPoints(nett: number | null): number {
    if (nett == null) return 0;

    if (nett <= -3) return 6; // condor
    if (nett === -2) return 5; // albatross
    if (nett === -1) return 4; // eagle
    if (nett === 0) return 3; // birdie
    if (nett === 1) return 2; // par
    if (nett === 2) return 1; // bogey
    return 0; // double bogey or worse
  }

  // -------------------------------
  // UI Rendering
  // -------------------------------

  if (!competitionId) {
    return (
      <div className="p-4 text-red-600">
        Missing competition id.  
        Please start from the Players page.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">

      {/* PREMIUM HEADER CARD */}
      <div className="bg-white rounded-lg shadow p-5 text-center border">
        <h2 className="text-4xl font-extrabold uppercase tracking-wide">
          {holeTitle}
        </h2>

        {holeSI != null && (
          <p className="text-lg font-semibold mt-1">Stroke Index: {holeSI}</p>
        )}

        {tee && (
          <p className="mt-2 text-gray-700 font-semibold uppercase">
            {tee.tee_name} TEE
          </p>
        )}

        {holeYards != null && holeMetres != null && (
          <p className="text-sm text-gray-600 mt-1">
            {holeYards} yds / {holeMetres} m
          </p>
        )}
      </div>

      {/* Prev / Next / Finish */}
      <div className="flex items-center justify-between bg-white p-3 rounded shadow">
        <button className="px-3 py-2 bg-gray-200 rounded" onClick={handlePrev}>
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

      {/* Leaderboard Links */}
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

      {/* Headings */}
      <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700 px-1">
        <div className="col-span-7">Player Name</div>
        <div className="col-span-5 text-right">Strokes on Hole</div>
      </div>

      {/* Player Rows with Stableford Preview */}
      <div className="space-y-2">
        {players.map((p) => {
          const strokes = scores[p.id]?.[currentHole] ?? DEFAULT_STROKES;

          // SHOTS RECEIVED
          const shots = getShotsReceived(p.playing_handicap, holeSI);

          // NETT
          const nett =
            holePar != null ? strokes - shots - holePar : null;

          // Stableford Points
          const pts = nett != null ? getStablefordPoints(nett) : 0;

          // Colour tag
          const ptsColor =
            pts >= 4
              ? "text-purple-600"
              : pts === 3
              ? "text-green-600"
              : pts === 2
              ? "text-blue-600"
              : pts === 1
              ? "text-orange-600"
              : "text-red-600";

          return (
            <div
              key={p.id}
              className="bg-white p-3 rounded shadow space-y-1"
            >
              {/* Line 1: Player + input + +/- */}
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7 font-medium">
                  {p.player_name}
                </div>

                <div className="col-span-5 flex items-center justify-end gap-2">
                  <button
                    className="h-10 w-10 rounded bg-gray-200 text-xl leading-none"
                    onClick={() => adjustStroke(p.id, -1)}
                  >
                    –
                  </button>

                  <input
                    className="w-20 text-center p-2 border rounded"
                    inputMode="numeric"
                    value={strokes.toString()}
                    onChange={(e) => setStroke(p.id, e.target.value)}
                  />

                  <button
                    className="h-10 w-10 rounded bg-gray-200 text-xl leading-none"
                    onClick={() => adjustStroke(p.id, +1)}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Line 2: Nett + Points + Shots */}
              <div className="text-sm flex justify-between px-1">
                <span>
                  Nett:{" "}
                  <span className="font-semibold">
                    {nett != null ? nett : "-"}
                  </span>
                  {" • "}
                  <span className={`font-semibold ${ptsColor}`}>
                    {pts} pts
                  </span>
                </span>

                <span className="text-gray-600">
                  (Receives {shots} shot
                  {shots === 1 ? "" : "s"} on this hole)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Finish Modal */}
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
