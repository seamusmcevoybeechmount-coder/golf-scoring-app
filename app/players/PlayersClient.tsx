"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Tee = { id: string; tee_name: string };
type PlayerDraft = { name: string; index: string };

export default function PlayersClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const courseId = sp.get("course_id");

  const [tees, setTees] = useState<Tee[]>([]);
  const [selectedTee, setSelectedTee] = useState<string>("");
  const [players, setPlayers] = useState<PlayerDraft[]>([{ name: "", index: "" }]);

  useEffect(() => {
    if (!courseId) return;
    const load = async () => {
      const { data } = await supabase
        .from("tees")
        .select("id, tee_name")
        .eq("course_id", courseId)
        .order("tee_name");
      setTees(data ?? []);
      if (data && data.length) setSelectedTee(data[0].id);
    };
    load();
  }, [courseId]);

  const canSubmit = useMemo(() => {
    return !!courseId && !!selectedTee && players.some((p) => p.name.trim());
  }, [courseId, selectedTee, players]);

  const addPlayer = () => setPlayers((prev) => [...prev, { name: "", index: "" }]);

  const removePlayer = (i: number) =>
    setPlayers((prev) => prev.filter((_, idx) => idx !== i));

  async function handleStart() {
    if (!canSubmit) return;

    const compRes = await fetch("/api/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        course_id: courseId,
        tee_id: selectedTee,
        name: null,
      }),
    });

    const { competition_id } = await compRes.json();

    const cleaned = players
      .map((p) => ({
        name: p.name.trim(),
        handicap_index: Number(p.index),
      }))
      .filter((p) => p.name && !Number.isNaN(p.handicap_index));

    await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        competition_id,
        tee_id: selectedTee,
        players: cleaned,
      }),
    });

    router.push(`/score?competition_id=${competition_id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Player Entry</h1>

      {!courseId && (
        <p className="text-red-600">No course selected. Go back and choose a course.</p>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium">Competition Tee</label>
        <select
          className="w-full p-2 bg-white border rounded"
          value={selectedTee}
          onChange={(e) => setSelectedTee(e.target.value)}
        >
          {tees.map((t) => (
            <option key={t.id} value={t.id}>
              {t.tee_name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Players</h2>
        {players.map((p, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded shadow"
          >
            <input
              className="col-span-6 p-2 border rounded"
              placeholder={`Player ${i + 1} name`}
              value={p.name}
              onChange={(e) => {
                const val = e.target.value;
                setPlayers((prev) =>
                  prev.map((pp, idx) => (idx === i ? { ...pp, name: val } : pp))
                );
              }}
            />

            <input
              className="col-span-5 p-2 border rounded"
              placeholder="WHS index"
              value={p.index}
              onChange={(e) => {
                const val = e.target.value;
                setPlayers((prev) =>
                  prev.map((pp, idx) => (idx === i ? { ...pp, index: val } : pp))
                );
              }}
            />

            <button className="col-span-1 text-red-600" onClick={() => removePlayer(i)}>
              ×
            </button>
          </div>
        ))}

        <button className="px-3 py-2 bg-gray-200 rounded" onClick={addPlayer}>
          + Add Player
        </button>
      </div>

      <button
        className="px-4 py-2 rounded text-white disabled:opacity-50 bg-blue-600"
        disabled={!canSubmit}
        onClick={handleStart}
      >
        Start Scoring
      </button>
    </div>
  );
}
