import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const { competition_id, player_id, hole_number, strokes } = await req.json();
    if (!competition_id || !player_id || !hole_number || !strokes)
      return NextResponse.json({ error: 'competition_id, player_id, hole_number, strokes required' }, { status: 400 });

    const { error } = await supabaseServer.rpc('upsert_score', {
      p_competition_id: competition_id,
      p_player_id: player_id,
      p_hole: hole_number,
      p_strokes: strokes,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to save score' }, { status: 500 });
  }
}
