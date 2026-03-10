"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Player = {
  id: string;
  player_name: string;
  handicap_index: number;   // WHS Handicap Index (HI)
  playing_handicap: number; // DB value (not used for calculations if custom allowance is enabled)
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

// === CHANGES ===
// Default strokes now 0 (was 5)
const DEFAULT_STROKES = 0;

// 95% allowance for Stableford (unchanged)
const ALLOWANCE = 0.95;

export default function ScoreClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const competitionId = sp.get("competition_id");

  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [tee, setTee] = useState<TeeRow | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Derived hole meta (we still compute, but we will not show SI/distance in the header)
  const holePar = tee?.par?.[currentHole - 1] ?? null;
  const holeSI = tee?.stroke_index?.[currentHole - 1] ?? null;
  const holeYards = tee?.yardage?.[currentHole - 1] ?? null;
  const holeMetres = tee?.metres?.[currentHole - 1] ?? null;

  // === CHANGES ===
  // Header is now only "HOLE X" (removed "• PAR ...")
  const holeTitle = useMemo(() => `HOLE ${currentHole}`, [currentHole]);

  // -------------------------------
  // Helpers
  // -------------------------------

  /** Compute Course Handicap (CH) per WHS: CH = round(HI * (Slope/113) + (CR - Par)) */
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

  /** Compute Playing Handicap (PH) from CH using the competition allowance. */
  function getPlayingHandicapFromCH(courseHandicap: number | null): number | null {
    if (courseHandicap == null) return null;
    return Math.round(courseHandicap * ALLOWANCE);
  }

  // Load players, scores, tee meta
  useEffect(() => {
    if (!competitionId) return;
    let isCancelled = false;

    (async () => {
      // Load players
      const { data: playersData } = await supabase
        .from("players")
        .select("id, player_name, handicap_index, playing_handicap, tee_id")
        .eq("competition_id", competitionId)
        .order("created_at");

      if (!isCancelled) setPlayers(playersData ?? []);

      // Load score entries
      const { data: entryData } = await supabase
        .from("score_entries")
        .select("player_id, hole_number, strokes")
        .eq("competition_id", competitionId);

      if (!isCancelled) {
        const map: ScoreMap = {};
        (entryData ?? []).forEach((r: any) => {
          if (!map[r.player_id]) map[r.player_id] = {};
          map[r.player_id][r.hole_number] = r.strokes ?? undefined;
        });
        setScores(map);
      }

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

      if (!isCancelled && teeRow) setTee(teeRow as TeeRow);
    })();

    return () => {
      isCancelled = true;
    };
  }, [competitionId]);

  // Navigation
  const nextHole = useCallback(() => setCurrentHole((h) => (h % 18) + 1), []);
  const prevHole = useCallback(
    () => setCurrentHole((h) => ((h - 2 + 18) % 18) + 1),
    []
  );

  // Manual set from text input
  function setStroke(playerId: string, value: string) {
    const trimmed = value.trim();
    // === CHANGES === allow 0
    const n = trimmed === "" ? undefined : Number(trimmed);
    const safe =
      Number.isFinite(n as number) && (n as number) >= 0 ? (n as number) : undefined;

    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {}),
        [currentHole]: safe,
      },
    }));
  }

  // + / –
  function adjustStroke(playerId: string, delta: number) {
    const current = scores[playerId]?.[currentHole];
    // === CHANGES === floor at 0 (was 1) and start from DEFAULT_STROKES which is now 0
    const next = Math.max(0, (current ?? DEFAULT_STROKES) + delta);

    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {}),
        [currentHole]: next,
      },
    }));
  }

  // Save strokes for a hole
  async function saveHole() {
    if (!competitionId) return;

    const payloads = players.map((p) => {
      const val = scores[p.id]?.[currentHole];
      // === CHANGES === DEFAULT_STROKES is now 0, so blank saves as 0
      return { player_id: p.id, strokes: val ?? DEFAULT_STROKES };
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
    router.push(`/leaderboard?competition_id=${competitionId}`);
  }

  // -------------------------------
  // WHS STROKES RECEIVED + POINTS
  // -------------------------------

  function getShotsReceived(playingHandicap: number, si: number | null): number {
    if (si == null || playingHandicap <= 0) return 0;
    // Correct WHS distribution across 18 holes
    const base = Math.floor(playingHandicap / 18);
    const extras = playingHandicap % 18;
    return base + (si <= extras ? 1 : 0);
  }

  // Correct WHS Stableford mapping
  function getStablefordPoints(nett: number | null): number {
    if (nett == null) return 0;
    if (nett <= -3) return 5; // Albatross (double eagle)
    if (nett === -2) return 4; // Eagle
    if (nett === -1) return 3; // Birdie
    if (nett === 0) return 2; // Par
    if (nett === 1) return 1; // Bogey
    return 0; // Double bogey or worse
  }

  /** Sum Stableford points for a player from hole #1 up to currentHole (inclusive). */
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

  // -------------------------------
  // UI Rendering
  // -------------------------------

  if (!competitionId) {
    return (
      <div className="p-4 text-red-600">
        Missing competition id. Please start from the Players page.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER CARD */}
      <div className="bg-white rounded-lg shadow p-5 text-center border">
        {/* === CHANGES === Only hole number */}
        <h2 className="text-4xl font-extrabold uppercase tracking-wide">
          {holeTitle}
        </h2>

        {/* Removed: Stroke Index line */}
        {/* Removed: yardage/metres line */}

        {/* Keep tee name (remove if you want a cleaner header) */}
        {tee && (
          <p className="mt-2 text-gray-700 font-semibold uppercase">
            {tee.tee_name} TEE
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
        <div className="col-span-7">Player</div>
        <div className="col-span-5 text-right">Strokes on Hole</div>
      </div>

      {/* Player Rows with Stableford Preview + Cumulative */}
      <div className="space-y-2">
        {players.map((p) => {
          const strokes = scores[p.id]?.[currentHole] ?? DEFAULT_STROKES;
          // Compute CH and PH (using custom allowance) for display & calculations
          const courseHcp = getCourseHandicap(p.handicap_index, tee);
          const playingHcp = getPlayingHandicapFromCH(courseHcp) ?? 0;
          const shots = getShotsReceived(playingHcp, holeSI);
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
            playingHcp
          );

          return (
            <div key={p.id} className="bg-white p-3 rounded shadow space-y-1">
              {/* Line 1: Player + HI/CH/PH + input + +/- */}
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7 font-medium">
                  <div>{p.player_name}</div>
                  <div className="text-xs text-gray-600">
                    HI {p.handicap_index.toFixed(1)} • CH {courseHcp ?? "-"} • PH{" "}
                    {courseHcp == null ? "-" : playingHcp}
                  </div>
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

              {/* Line 2: Nett + Points + Shots */}
              <div className="text-sm flex justify-between px-1">
                <span>
                  Nett: <span className="font-semibold">{nett != null ? nett : "-"}</span>
                  {" • "}
                  <span className={`font-semibold ${ptsColor}`}>{pts} pts</span>
                </span>
                <span className="text-gray-600">
                  (Receives {shots} shot{shots === 1 ? "" : "s"} on this hole)
                </span>
              </div>

              {/* Line 3: Cumulative total (red, italic) */}
              <div className="text-sm text-red-600 italic px-1">
                Total Stableford Points (to Hole {currentHole}): {cumulative}
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
}"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Player = {
  id: string;
  player_name: string;
  handicap_index: number;   // WHS Handicap Index (HI)
  playing_handicap: number; // DB value (not used for calculations if custom allowance is enabled)
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

// === CHANGES ===
// Default strokes now 0 (was 5)
const DEFAULT_STROKES = 0;

// 95% allowance for Stableford (unchanged)
const ALLOWANCE = 0.95;

export default function ScoreClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const competitionId = sp.get("competition_id");

  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [tee, setTee] = useState<TeeRow | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Derived hole meta (we still compute, but we will not show SI/distance in the header)
  const holePar = tee?.par?.[currentHole - 1] ?? null;
  const holeSI = tee?.stroke_index?.[currentHole - 1] ?? null;
  const holeYards = tee?.yardage?.[currentHole - 1] ?? null;
  const holeMetres = tee?.metres?.[currentHole - 1] ?? null;

  // === CHANGES ===
  // Header is now only "HOLE X" (removed "• PAR ...")
  const holeTitle = useMemo(() => `HOLE ${currentHole}`, [currentHole]);

  // -------------------------------
  // Helpers
  // -------------------------------

  /** Compute Course Handicap (CH) per WHS: CH = round(HI * (Slope/113) + (CR - Par)) */
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

  /** Compute Playing Handicap (PH) from CH using the competition allowance. */
  function getPlayingHandicapFromCH(courseHandicap: number | null): number | null {
    if (courseHandicap == null) return null;
    return Math.round(courseHandicap * ALLOWANCE);
  }

  // Load players, scores, tee meta
  useEffect(() => {
    if (!competitionId) return;
    let isCancelled = false;

    (async () => {
      // Load players
      const { data: playersData } = await supabase
        .from("players")
        .select("id, player_name, handicap_index, playing_handicap, tee_id")
        .eq("competition_id", competitionId)
        .order("created_at");

      if (!isCancelled) setPlayers(playersData ?? []);

      // Load score entries
      const { data: entryData } = await supabase
        .from("score_entries")
        .select("player_id, hole_number, strokes")
        .eq("competition_id", competitionId);

      if (!isCancelled) {
        const map: ScoreMap = {};
        (entryData ?? []).forEach((r: any) => {
          if (!map[r.player_id]) map[r.player_id] = {};
          map[r.player_id][r.hole_number] = r.strokes ?? undefined;
        });
        setScores(map);
      }

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

      if (!isCancelled && teeRow) setTee(teeRow as TeeRow);
    })();

    return () => {
      isCancelled = true;
    };
  }, [competitionId]);

  // Navigation
  const nextHole = useCallback(() => setCurrentHole((h) => (h % 18) + 1), []);
  const prevHole = useCallback(
    () => setCurrentHole((h) => ((h - 2 + 18) % 18) + 1),
    []
  );

  // Manual set from text input
  function setStroke(playerId: string, value: string) {
    const trimmed = value.trim();
    // === CHANGES === allow 0
    const n = trimmed === "" ? undefined : Number(trimmed);
    const safe =
      Number.isFinite(n as number) && (n as number) >= 0 ? (n as number) : undefined;

    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {}),
        [currentHole]: safe,
      },
    }));
  }

  // + / –
  function adjustStroke(playerId: string, delta: number) {
    const current = scores[playerId]?.[currentHole];
    // === CHANGES === floor at 0 (was 1) and start from DEFAULT_STROKES which is now 0
    const next = Math.max(0, (current ?? DEFAULT_STROKES) + delta);

    setScores((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {}),
        [currentHole]: next,
      },
    }));
  }

  // Save strokes for a hole
  async function saveHole() {
    if (!competitionId) return;

    const payloads = players.map((p) => {
      const val = scores[p.id]?.[currentHole];
      // === CHANGES === DEFAULT_STROKES is now 0, so blank saves as 0
      return { player_id: p.id, strokes: val ?? DEFAULT_STROKES };
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
    router.push(`/leaderboard?competition_id=${competitionId}`);
  }

  // -------------------------------
  // WHS STROKES RECEIVED + POINTS
  // -------------------------------

  function getShotsReceived(playingHandicap: number, si: number | null): number {
    if (si == null || playingHandicap <= 0) return 0;
    // Correct WHS distribution across 18 holes
    const base = Math.floor(playingHandicap / 18);
    const extras = playingHandicap % 18;
    return base + (si <= extras ? 1 : 0);
  }

  // Correct WHS Stableford mapping
  function getStablefordPoints(nett: number | null): number {
    if (nett == null) return 0;
    if (nett <= -3) return 5; // Albatross (double eagle)
    if (nett === -2) return 4; // Eagle
    if (nett === -1) return 3; // Birdie
    if (nett === 0) return 2; // Par
    if (nett === 1) return 1; // Bogey
    return 0; // Double bogey or worse
  }

  /** Sum Stableford points for a player from hole #1 up to currentHole (inclusive). */
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

  // -------------------------------
  // UI Rendering
  // -------------------------------

  if (!competitionId) {
    return (
      <div className="p-4 text-red-600">
        Missing competition id. Please start from the Players page.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER CARD */}
      <div className="bg-white rounded-lg shadow p-5 text-center border">
        {/* === CHANGES === Only hole number */}
        <h2 className="text-4xl font-extrabold uppercase tracking-wide">
          {holeTitle}
        </h2>

        {/* Removed: Stroke Index line */}
        {/* Removed: yardage/metres line */}

        {/* Keep tee name (remove if you want a cleaner header) */}
        {tee && (
          <p className="mt-2 text-gray-700 font-semibold uppercase">
            {tee.tee_name} TEE
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
        <div className="col-span-7">Player</div>
        <div className="col-span-5 text-right">Strokes on Hole</div>
      </div>

      {/* Player Rows with Stableford Preview + Cumulative */}
      <div className="space-y-2">
        {players.map((p) => {
          const strokes = scores[p.id]?.[currentHole] ?? DEFAULT_STROKES;
          // Compute CH and PH (using custom allowance) for display & calculations
          const courseHcp = getCourseHandicap(p.handicap_index, tee);
          const playingHcp = getPlayingHandicapFromCH(courseHcp) ?? 0;
          const shots = getShotsReceived(playingHcp, holeSI);
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
            playingHcp
          );

          return (
            <div key={p.id} className="bg-white p-3 rounded shadow space-y-1">
              {/* Line 1: Player + HI/CH/PH + input + +/- */}
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-7 font-medium">
                  <div>{p.player_name}</div>
                  <div className="text-xs text-gray-600">
                    HI {p.handicap_index.toFixed(1)} • CH {courseHcp ?? "-"} • PH{" "}
                    {courseHcp == null ? "-" : playingHcp}
                  </div>
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

              {/* Line 2: Nett + Points + Shots */}
              <div className="text-sm flex justify-between px-1">
                <span>
                  Nett: <span className="font-semibold">{nett != null ? nett : "-"}</span>
                  {" • "}
                  <span className={`font-semibold ${ptsColor}`}>{pts} pts</span>
                </span>
                <span className="text-gray-600">
                  (Receives {shots} shot{shots === 1 ? "" : "s"} on this hole)
                </span>
              </div>

              {/* Line 3: Cumulative total (red, italic) */}
              <div className="text-sm text-red-600 italic px-1">
                Total Stableford Points (to Hole {currentHole}): {cumulative}
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
