import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req: Request) {
  try {
    const { course_id, tee_id, name } = await req.json();
    if (!course_id || !tee_id) {
      return NextResponse.json({ error: 'course_id and tee_id required' }, { status: 400 });
    }
    const { data, error } = await supabaseServer.rpc('create_competition', {
      p_course_id: course_id,
      p_tee_id: tee_id,
      p_name: name ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ competition_id: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create competition' }, { status: 500 });
  }
}
