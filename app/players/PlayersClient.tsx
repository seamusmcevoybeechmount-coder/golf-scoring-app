"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/** Tee shape based on your Supabase table */
type Tee = {
  id: string;
  tee_name: string;
  slope_rating: number;
  course_rating: number;
  course_par: number;
};

type PlayerDraft = { name: string; index: string; teeId: string };

/** Parse number safely, allowing comma or dot */
function parseNumber(val: string): number | null {
  if (val.trim() === "") return null;
  const n = Number(val.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Validate WHS value (required only if name is present) */
function whsErrorFor(row: PlayerDraft): string | null {
  if (!row.name.trim()) return null; // No name → skip validation
  if (row.index.trim() === "") return "W.H.S. Handicap is required.";
  const n = parseNumber(row.index);
  if (n === null) return "Enter a number (e.g., 12.4).";
  if (n < 0 || n > 54) return "Value must be between 0 and 54.";
  return null;
}

/** Format to exactly 1 decimal place for display */
function formatOneDecimal(val: string): string {
  const n = parseNumber(val);
  if (n === null) return "";
  return n.toFixed(1);
}

/** World Handicap System course handicap */
function calcCourseHandicap(
  index: number,
  slope: number,
  rating: number,
  coursePar: number
) {
  const raw = index * (slope / 113) + (rating - coursePar);
  return Math.round(raw);
}

/** Playing handicaps at various allowances */
function calcPlayingHandicaps(courseHandicap: number) {
  return {
    pct100: Math.round(courseHandicap * 1.0),
    pct95: Math.round(courseHandicap * 0.95),
    pct85: Math.round(courseHandicap * 0.85),
    pct10: Math.round(courseHandicap * 0.10),
  };
}

export default function PlayersClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const courseId = sp.get("course_id");

  const [tees, setTees] = useState<Tee[]>([]);
  const [players, setPlayers] = useState<PlayerDraft[]>([
    { name: "", index: "", teeId: "" },
    { name: "", index: "", teeId: "" },
  ]);

  // Load tees for this course (with the rating data needed for calculations)
  useEffect(() => {
    if (!courseId) return;
    (async () => {
      const { data, error } = await supabase
        .from("tees")
        .select("id, tee_name, slope_rating, course_rating, course_par")
        .eq("course_id", courseId)
        .order("tee_name");

      if (error) {
        console.error(error);
        return;
      }

      const teeData = (data ?? []) as Tee[];
      setTees(teeData);

      // Set a default tee for any row missing a tee selection
      if (teeData.length) {
        setPlayers((prev) =>
          prev.map((p) => ({ ...p, teeId: p.teeId || teeData[0].id }))
        );
      }
    })();
  }, [courseId]);

  // Quick lookup for tee by id
  const teeById = useMemo(() => {
    const map = new Map<string, Tee>();
    for (const t of tees) map.set(t.id, t);
    return map;
  }, [tees]);

  /** Detect any inline validation errors */
  const hasAnyError = useMemo(
    () => players.some((p) => whsErrorFor(p) !== null),
    [players]
  );

  const canSubmit = useMemo(() => {
    if (!courseId || tees.length === 0) return false;
    const hasName = players.some((p) => p.name.trim());
    const allNamedHaveTee = players.every((p) => !p.name || p.teeId);
    return hasName && allNamedHaveTee && !hasAnyError;
  }, [courseId, tees, players, hasAnyError]);

  const addPlayer = () =>
    setPlayers((prev) => [
      ...prev,
      { name: "", index: "", teeId: tees[0]?.id ?? "" },
    ]);

  const removePlayer = (i: number) =>
    setPlayers((prev) => prev.filter((_, idx) => idx !== i));

  function setVal(i: number, key: keyof PlayerDraft, val: string) {
    setPlayers((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [key]: val } : p))
    );
  }

  /** Format WHS on blur */
  function handleWHSBlur(i: number) {
    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx !== i) return p;
        return { ...p, index: formatOneDecimal(p.index) };
      })
    );
  }

  async function handleStart() {
    if (!canSubmit || !courseId) return;

    const cleaned = players
      .map((p) => ({
        name: p.name.trim(),
        handicap_index: parseNumber(p.index),
        tee_id: p.teeId || tees[0]?.id,
      }))
      .filter(
        (p) =>
          p.name &&
          p.handicap_index !== null &&
          p.handicap_index >= 0 &&
          p.handicap_index <= 54 &&
          p.tee_id
      )
      .map((p) => ({
        ...p,
        handicap_index: Number(p.handicap_index),
      }));

    if (cleaned.length === 0) return;

    const compRes = await fetch("/api/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: courseId,
        tee_id: cleaned[0].tee_id,
        name: null,
      }),
    });
    if (!compRes.ok) {
      alert("Failed to create competition");
      return;
    }
    const { competition_id } = await compRes.json();

    const addRes = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competition_id,
        players: cleaned,
      }),
    });
    if (!addRes.ok) {
      alert("Failed to add players");
      return;
    }
    router.push(`/score?competition_id=${competition_id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Player Entry</h1>

      {!courseId && (
        <p className="text-red-600">
          No course selected. Go back and pick a course.
        </p>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Players</h2>

        <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700 px-1">
          <div className="col-span-4">Player’s Name</div>
          <div className="col-span-3">W.H.S. Handicap</div>
          <div className="col-span-4">Tee’s Being Played</div>
          <div className="col-span-1" />
        </div>

        {players.map((p, i) => {
          const whsErr = whsErrorFor(p);
          const whsInvalid = Boolean(whsErr);

          // Calculate handicaps if we have a valid index and a selected tee
          const idx = parseNumber(p.index);
          const tee = p.teeId ? teeById.get(p.teeId) ?? null : null;

          const courseHandicap =
            idx !== null && tee
              ? calcCourseHandicap(
                  idx,
                  tee.slope_rating,
                  tee.course_rating,
                  tee.course_par
                )
              : null;

          const playing =
            courseHandicap !== null ? calcPlayingHandicaps(courseHandicap) : null;

          return (
            <div key={i} className="space-y-2">
              {/* Row inputs */}
              <div className="grid grid-cols-12 gap-2 items-start bg-white p-3 rounded shadow">
                <div className="col-span-4">
                  <input
                    placeholder={`Player ${i + 1}`}
                    className="w-full p-2 border rounded"
                    value={p.name}
                    onChange={(e) => setVal(i, "name", e.target.value)}
                  />
                </div>

                <div className="col-span-3">
                  <input
                    placeholder="e.g. 12.4"
                    className={`w-full p-2 border rounded ${
                      whsInvalid ? "border-red-500 focus:outline-red-500" : ""
                    }`}
                    inputMode="decimal"
                    value={p.index}
                    onChange={(e) => setVal(i, "index", e.target.value)}
                    onBlur={() => handleWHSBlur(i)}
                  />
                  {whsInvalid && (
                    <p className="mt-1 text-xs text-red-600">{whsErr}</p>
                  )}
                </div>

                <div className="col-span-4">
                  <select
                    className="w-full p-2 bg-white border rounded"
                    value={p.teeId}
                    onChange={(e) => setVal(i, "teeId", e.target.value)}
                  >
                    {tees.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.tee_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 flex justify-center pt-1">
                  <button
                    className="text-red-600"
                    onClick={() => removePlayer(i)}
                    title="Remove"
                    aria-label={`Remove player row ${i + 1}`}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Live handicap summary */}
              {playing && courseHandicap !== null && (
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 md:col-span-8 md:col-start-5">
                    <div className="rounded border bg-gray-50 p-2 text-xs text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <strong>Index:</strong> {formatOneDecimal(p.index)}
                      </span>
                      <span>
                        <strong>Course:</strong> {courseHandicap}
                      </span>
                      <span>
                        <strong>100%:</strong> {playing.pct100}
                      </span>
                      <span>
                        <strong>95%:</strong> {playing.pct95}
                      </span>
                      <span>
                        <strong>85%:</strong> {playing.pct85}
                      </span>
                      <span>
                        <strong>10%:</strong> {playing.pct10}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button onClick={addPlayer} className="px-3 py-2 bg-gray-200 rounded">
          + Add Player
        </button>
      </div>

      <div>
        <button
          disabled={!canSubmit}
          onClick={handleStart}
          className="px-4 py-2 rounded text-white disabled:opacity-50 bg-blue-600"
        >
          Start Scoring
        </button>
      </div>
    </div>
  );
}
