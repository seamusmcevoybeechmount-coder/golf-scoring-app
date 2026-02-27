import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { competition_id, players } = await req.json();

    if (!competition_id || !Array.isArray(players) || players.length === 0) {
      return NextResponse.json(
        { error: "competition_id and players[] required" },
        { status: 400 }
      );
    }

    const results: string[] = [];
    for (const p of players) {
      if (!p.name || typeof p.handicap_index !== "number" || !p.tee_id) continue;

      const { data, error } = await supabaseServer.rpc("add_player", {
        p_competition_id: competition_id,
        p_player_name: p.name,
        p_handicap_index: p.handicap_index,
        p_tee_id: p.tee_id,
        p_allowance: 0.95,
      });
      if (error) throw error;
      results.push(data as string);
    }

    return NextResponse.json({ player_ids: results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to add players" },
      { status: 500 }
    );
  }
}
