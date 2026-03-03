"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Tee = { id: string; tee_name: string };
type PlayerDraft = { name: string; index: string; teeId: string };

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
      if (error) console.error(error);
      setTees(data ?? []);
      // Preselect first tee for each player row (only if not set)
      if (data && data.length) {
        setPlayers((prev) =>
          prev.map((p) => ({ ...p, teeId: p.teeId || data[0].id }))
        );
      }
    })();
  }, [courseId]);

  const canSubmit = useMemo(() => {
    if (!courseId || tees.length === 0) return false;
    return (
      players.some((p) => p.name.trim()) &&
      // if a name is given, a tee must be chosen
      players.every((p) => !p.name || p.teeId)
    );
  }, [courseId, tees, players]);

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
        handicap_index: Number(p.index),
        tee_id: p.teeId || tees[0]?.id,
      }))
      .filter((p) => p.name && !Number.isNaN(p.handicap_index) && p.tee_id);

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
          <div className="col-span-1"></div>
        </div>

        {players.map((p, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded shadow"
          >
            {/* Player Name */}
            <input
              placeholder={`Player ${i + 1}`}
              className="col-span-4 p-2 border rounded"
              value={p.name}
              onChange={(e) => setVal(i, "name", e.target.value)}
            />

            {/* Handicap Index */}
            <input
              placeholder="e.g. 12.4"
              className="col-span-3 p-2 border rounded"
              inputMode="decimal"
              value={p.index}
              onChange={(e) => setVal(i, "index", e.target.value)}
            />

            {/* Tee selection */}
            <select
              className="col-span-4 p-2 bg-white border rounded"
              value={p.teeId}
              onChange={(e) => setVal(i, "teeId", e.target.value)}
            >
              {tees.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tee_name}
                </option>
              ))}
            </select>

            {/* Remove button */}
            <button
              className="col-span-1 text-red-600"
              onClick={() => removePlayer(i)}
              title="Remove"
              aria-label={`Remove player row ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}

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
