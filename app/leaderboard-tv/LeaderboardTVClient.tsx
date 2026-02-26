"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  player_id: string;
  player_name: string;
  competition_id: string;
  total_points: number | null;
  holes_recorded: number;
};

export default function LeaderboardTVClient() {
  const sp = useSearchParams();
  const competitionId = sp.get("competition_id");
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    if (!competitionId) return;
    const { data } = await supabase
      .from("leaderboard")
      .select("*")
      .eq("competition_id", competitionId)
      .order("total_points", { ascending: false });
    setRows(data ?? []);
  }

  useEffect(() => {
    load();
    if (!competitionId) return;

    const channel = supabase
      .channel("lb-tv")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "score_entries" },
        load
      )
      .subscribe();

    const interval = setInterval(load, 15000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [competitionId]);

  return (
    <div className="mx-auto max-w-screen-lg p-6">
      <h1 className="text-4xl font-extrabold mb-4">Leaderboard</h1>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((r, i) => (
          <div
            key={r.player_id}
            className="flex items-center justify-between bg-white p-4 rounded shadow text-2xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 text-right">{i + 1}</div>
              <div className="font-semibold">{r.player_name}</div>
            </div>
            <div className="font-bold">{r.total_points ?? 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
