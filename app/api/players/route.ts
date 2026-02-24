import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const { competition_id, tee_id, players } = await req.json();
    if (!competition_id || !tee_id || !Array.isArray(players))
      return NextResponse.json({ error: 'competition_id, tee_id and players[] required' }, { status: 400 });

    const results: string[] = [];
    for (const p of players) {
      const { data, error } = await supabaseServer.rpc('add_player', {
        p_competition_id: competition_id,
        p_player_name: p.name,
        p_handicap_index: p.handicap_index,
        p_tee_id: tee_id,
        p_allowance: 0.95,
      });
      if (error) throw error;
      results.push(data as string);
    }

    return NextResponse.json({ player_ids: results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to add players' }, { status: 500 });
  }
}
