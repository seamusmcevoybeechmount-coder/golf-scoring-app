"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Player = {
  id: string;
  player_name: string;
  handicap_index: number;
  playing_handicap: number;
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

// Default strokes = 0
const DEFAULT_STROKES = 0;

// 95% Stableford allowance
const ALLOWANCE = 0.95;

// Domain for share links
const BASE_URL = "https://golf-scoring-app-omega.vercel.app";

export default function ScoreClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const competitionId = sp.get("competition_id");

  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [tee, setTee] = useState<TeeRow | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Initial hole from URL
  const initialHole = useMemo(() => {
    const h = Number(sp.get("hole") || "1");
    return Number.isFinite(h) && h >= 1 && h <= 18 ? h : 1;
  }, [sp]);

  const [currentHole, setCurrentHole] = useState<number>(initialHole);

  const holePar = tee?.par?.[currentHole - 1] ?? null;
  const holeSI = tee?.stroke_index?.[currentHole - 1] ?? null;

  // Keep hole number synced to URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("hole", String(currentHole));
    if (competitionId) {
      url.searchParams.set("competition_id", competitionId);
    }
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }, [currentHole, competitionId, router]);

  // Compute CH
  function getCourseHandicap(
    handicapIndex: number | null | undefined,
    teeRow: TeeRow | null
  ): number | null {
    if (handicapIndex == null || !teeRow) return null;
    const ch =
      handicapIndex * (teeRow.slope_rating / 113) +
      (teeRow.course_rating - teeRow.course_par);
    return Math.round(ch);
  }

  // Compute PH (95%)
  function getPlayingHandicapFromCH(courseHandicap: number | null): number | null {
    if (courseHandicap == null) return null;
    return Math.round(courseHandicap * ALLOWANCE);
  }

  // Load players, scores, tee info
  useEffect(() => {
    if (!competitionId) return;
    let cancelled = false;

    (async () => {
      const { data: playersData } = await supabase
        .from("players")
        .select("id, player_name, handicap_index, playing_handicap, tee_id")
        .eq("competition_id", competitionId)
        .order("created_at");

      if (!cancelled) {
        setPlayers(playersData ?? []);
      }

      const { data: entryData } = await supabase
        .from("score_entries")
        .select("player_id, hole_number, strokes")
        .eq("competition_id", competitionId);

      if (!cancelled) {
        const map: ScoreMap = {};
        (entryData ?? []).forEach((r) => {
          if (!map[r.player_id]) map[r.player_id] = {};
          map[r.player_id][r.hole_number] = r.strokes ?? undefined;
        });
        setScores(map);
      }

      const { data: compRow } = await supabase
        .from("competitions")
        .select("tee_id")
        .eq("id", competitionId)
        .single();

      if (!compRow?.tee_id) return;

      const { data: teeRow } = await supabase
        .from("tees")
        .select(
          "id, tee_name, par, stroke_index, yardage, metres, course_rating, slope_rating, course_par"
        )
        .eq("id", compRow.tee_id)
        .single();

      if (!cancelled && teeRow) {
        setTee(teeRow as TeeRow);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  // Immediate scoring save
  async function saveScoreImmediately(
    playerId: string,
    hole: number,
    strokes: number
  ) {
    if (!competitionId) return;

    await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competition_id: competitionId,
        player_id: playerId,
        hole_number: hole,
        strokes,
      }),
    });
  }

  // Manual input score
  async function setStroke(playerId: string, value: string) {
    const trimmed = value.trim();
    const n = trimmed === "" ? undefined : Number(trimmed);
    const safe =
      Number.isFinite(n as number) && (n as number) >= 0 ? (n as number) : undefined;

    // UI state update
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [currentHole]: safe },
    }));

    // Save instantly
    await saveScoreImmediately(playerId, currentHole, safe ?? DEFAULT_STROKES);
  }

  // +/- scoring
  async function adjustStroke(playerId: string, delta: number) {
    const current = scores[playerId]?.[currentHole] ?? DEFAULT_STROKES;
    const next = Math.max(0, current + delta);

    setScores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [currentHole]: next },
    }));

    // Save instantly
    await saveScoreImmediately(playerId, currentHole, next);
  }

  // NEXT hole
  const nextHole = useCallback(() => {
    setCurrentHole((h) => (h % 18) + 1);
  }, []);

  // PREV hole
  const prevHole = useCallback(() => {
    setCurrentHole((h) => ((h - 2 + 18) % 18) + 1);
  }, []);

  // FINISH button
  async function handleFinish() {
    router.push(`/leaderboard?competition_id=${competitionId}`);
  }

  // WHS logic
  function getShotsReceived(playingHandicap: number, si: number | null): number {
    if (si == null || playingHandicap <= 0) return 0;
    const base = Math.floor(playingHandicap / 18);
    const extras = playingHandicap % 18;
    return base + (si <= extras ? 1 : 0);
  }

  function getStablefordPoints(nett: number | null): number {
    if (nett == null) return 0;
    if (nett <= -3) return 5;
    if (nett === -2) return 4;
    if (nett === -1) return 3;
    if (nett === 0) return 2;
    if (nett === 1) return 1;
    return 0;
  }

  function getCumulativePointsUpTo(
    playerId: string,
    uptoHole: number,
    teeRow: TeeRow | null,
    scoreMap: ScoreMap,
    playingHandicap: number
  ): number {
    if (!teeRow) return 0;

    let total = 0;

    for (let h = 1; h <= uptoHole; h++) {
      const par = teeRow.par?.[h - 1] ?? null;
      const si = teeRow.stroke_index?.[h - 1] ?? null;
      const strokes = scoreMap[playerId]?.[h] ?? DEFAULT_STROKES;
      const shots = getShotsReceived(playingHandicap, si);
      const nettToPar = par != null ? (strokes - shots) - par : null;
      total += getStablefordPoints(nettToPar);
    }

    return total;
  }

  // SHARE BUTTONS
  async function shareLeaderboard() {
    const url = `${BASE_URL}/leaderboard?competition_id=${competitionId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Golf Scoring – Leaderboard",
          text: "Live leaderboard link:",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Leaderboard link copied!");
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  }

  async function shareTVLeaderboard() {
    const url = `${BASE_URL}/leaderboard-tv?competition_id=${competitionId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Golf Scoring – TV Leaderboard",
          text: "Live TV leaderboard link:",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert("TV Leaderboard link copied!");
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
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

      {/* Prev/Next */}
      <div className="flex items-center justify-between bg-white p-3 rounded shadow">
        <button className="px-3 py-2 bg-gray-200 rounded" onClick={prevHole}>
          Prev
        </button>

        <div />

        {currentHole < 18 ? (
          <button
            onClick={nextHole}
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

      {/* SHARE BUTTONS */}
      <div className="flex gap-2">
        <button
          onClick={shareLeaderboard}
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          Share Leaderboard
        </button>

        <button
          onClick={shareTVLeaderboard}
          className="px-3 py-2 bg-gray-800 text-white rounded"
        >
          Share TV Leaderboard
        </button>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700 px-1">
        <div className="col-span-7">Player</div>
        <div className="col-span-5 text-right">Strokes on Hole</div>
      </div>

      {/* PLAYER ROWS */}
      <div className="space-y-2">
        {players.map((p) => {
          const strokes = scores[p.id]?.[currentHole] ?? DEFAULT_STROKES;

          const ch = getCourseHandicap(p.handicap_index, tee);
          const ph = getPlayingHandicapFromCH(ch) ?? 0;

          const shots = getShotsReceived(ph, holeSI);
          const nett = holePar != null ? (strokes - shots) - holePar : null;

          const pts = nett != null ? getStablefordPoints(nett) : 0;
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

          const cumulative = getCumulativePointsUpTo(
            p.id,
            currentHole,
            tee,
            scores,
            ph
          );

          return (
            <div key={p.id} className="bg-white p-3 rounded shadow space-y-1">
              {/* Row 1 */}
              <div className="grid grid-cols-12 gap-2 items-center">
                {/* Player info */}
                <div className="col-span-7 font-medium">
                  <div>{p.player_name}</div>
                  <div className="text-xs text-gray-600">
                    HI {p.handicap_index.toFixed(1)} • CH {ch ?? "-"} • PH{" "}
                    {ch == null ? "-" : ph}
                  </div>
                </div>

                {/* Score Controls */}
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
                    value={(strokes ?? "").toString()}
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

              {/* Row 2 */}
              <div className="text-sm flex justify-between px-1">
                <span>
                  Nett: <span className="font-semibold">{nett ?? "-"}</span>
                  {" • "}
                  <span className={`font-semibold ${ptsColor}`}>{pts} pts</span>
                </span>

                <span className="text-gray-600">
                  (Receives {shots} shot{shots === 1 ? "" : "s"})
                </span>
              </div>

              {/* Row 3 */}
              <div className="text-sm text-red-600 italic px-1">
                Total Stableford Points (to Hole {currentHole}): {cumulative}
              </div>
            </div>
          );
        })}
      </div>

      {/* FINISH CONFIRMATION */}
      {showFinishConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-xl space-y-4 max-w-sm text-center">
            <h2 className="text-xl font-bold">Finish Round?</h2>
            <p className="text-gray-700">
              Are you sure you want to finish the round? You can still go back and adjust
              scores if needed.
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
