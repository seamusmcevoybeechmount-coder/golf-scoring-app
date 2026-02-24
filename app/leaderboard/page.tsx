'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Row = { player_id: string; player_name: string; competition_id: string; total_points: number | null; holes_recorded: number };

export default function LeaderboardPage() {
  const sp = useSearchParams();
  const competitionId = sp.get('competition_id');
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    if (!competitionId) return;
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('competition_id', competitionId)
      .order('total_points', { ascending: false });
    setRows(data ?? []);
  }

  useEffect(() => {
    load();
    if (!competitionId) return;
    const channel = supabase
      .channel('lb')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_entries' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [competitionId]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Live Leaderboard</h1>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.player_id} className="flex items-center justify-between bg-white p-3 rounded shadow">
            <div className="flex items-center gap-3">
              <div className="w-6 text-right">{i+1}</div>
              <div className="font-medium">{r.player_name}</div>
            </div>
            <div className="font-semibold">{r.total_points ?? 0} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
}
