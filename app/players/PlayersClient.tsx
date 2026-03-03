"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Tee = { id: string; tee_name: string };
type PlayerDraft = { name: string; index: string; teeId: string };

function parseNumber(val: string): number | null {
  if (val.trim() === "") return null;
  const n = Number(val.replace(",", ".")); // allow commas typed on mobile
  return Number.isFinite(n) ? n : null;
}

function isValidWHS(val: string): boolean {
  const n = parseNumber(val);
  if (n === null) return false;        // required when name is present
  return n >= 0 && n <= 54;            // inclusive bounds
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

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      const { data, error } = await supabase
        .from("tees")
        .select("id, tee_name")
        .eq("course_id", courseId)
        .order("tee_name");

      if (error) {
        console.error(error);
        return;
      }

      setTees(data ?? []);

      // Preselect first tee for each player row (only if not set)
      if (data && data.length) {
        setPlayers((prev) =>
          prev.map((p) => ({ ...p, teeId: p.teeId || data[0].id }))
        );
      }
    })();
  }, [courseId]);

  /** Field-level error for a single row (only enforced when name is non-empty) */
  function whsErrorFor(row: PlayerDraft): string | null {
    if (!row.name.trim()) return null; // if no name, no validation required
    if (row.index.trim() === "") return "W.H.S. Handicap is required.";
    const n = parseNumber(row.index);
    if (n === null) return "Enter a number (e.g., 12.4).";
    if (n < 0 || n > 54) return "Value must be between 0 and 54.";
    return null;
  }

  /** Whether any visible validation error exists across rows */
  const hasAnyError = useMemo(() => {
    return players.some((p) => whsErrorFor(p) !== null);
  }, [players]);

  const canSubmit = useMemo(() => {
    if (!courseId || tees.length === 0) return false;
    const hasAtLeastOneNamed = players.some((p) => p.name.trim());
    const allNamedHaveTee = players.every((p) => !p.name || p.teeId);
    return hasAtLeastOneNamed && allNamedHaveTee && !hasAnyError;
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

  async function handleStart() {
    if (!canSubmit || !courseId) return;

    // 1) Clean players: only those with a name; convert index to number
    const cleaned = players
      .map((p) => ({
        name: p.name.trim(),
        handicap_index: parseNumber(p.index), // already validated non-null if name present
        tee_id: p.teeId || tees[0]?.id,
      }))
      .filter(
        (p) =>
          p.name &&
          p.handicap_index !== null &&
          !Number.isNaN(p.handicap_index) &&
          p.handicap_index! >= 0 &&
          p.handicap_index! <= 54 &&
          p.tee_id
      )
      .map((p) => ({
        ...p,
        handicap_index: Number(p.handicap_index),
      }));

    if (cleaned.length === 0) return;

    // 2) Create competition (using first player's tee to satisfy schema)
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

    // 3) Add players with their own tee_id
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

    // 4) Go to scoring
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

      {/* Players grid with headings */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg">Players</h2>

        {/* Column headings */}
        <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-gray-700 px-1">
          <div className="col-span-4">Player’s Name</div>
          <div className="col-span-3">W.H.S. Handicap</div>
          <div className="col-span-4">Tee’s Being Played</div>
          <div className="col-span-1" />
        </div>

        {players.map((p, i) => {
          const whsError = whsErrorFor(p);
          const whsInvalid = Boolean(whsError);
          return (
            <div
              key={i}
              className="grid grid-cols-12 gap-2 items-start bg-white p-3 rounded shadow"
            >
              {/* Player Name */}
              <div className="col-span-4">
                <input
                  placeholder={`Player ${i + 1}`}
                  className="w-full p-2 border rounded"
                  value={p.name}
                  onChange={(e) => setVal(i, "name", e.target.value)}
                />
              </div>

              {/* Handicap Index with inline validation */}
              <div className="col-span-3">
                <input
                  placeholder="e.g. 12.4"
                  className={`w-full p-2 border rounded ${
                    whsInvalid ? "border-red-500 focus:outline-red-500" : ""
                  }`}
                  inputMode="decimal"
                  // pattern allows numbers like 12, 12.4, .5, 0, 54
                  pattern="^([0-9]{1,2}(\.[0-9]{1,2})?|54(\.0{1,2})?)$"
                  value={p.index}
                  onChange={(e) => setVal(i, "index", e.target.value)}
                  aria-invalid={whsInvalid || undefined}
                  aria-describedby={whsInvalid ? `whs-error-${i}` : undefined}
                />
                {whsInvalid && (
                  <p
                    id={`whs-error-${i}`}
                    className="mt-1 text-xs text-red-600"
                  >
                    {whsError}
                  </p>
                )}
              </div>

              {/* Tee selection */}
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

              {/* Remove button */}
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
