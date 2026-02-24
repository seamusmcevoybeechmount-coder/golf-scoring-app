'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

type Course = { id: string; name: string };

enum LoadState { Idle, Loading, Loaded }

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [state, setState] = useState<LoadState>(LoadState.Idle);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      setState(LoadState.Loading);
      const { data, error } = await supabase.from('courses').select('id,name').order('name');
      if (error) console.error(error);
      setCourses(data ?? []);
      setState(LoadState.Loaded);
    };
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Select Course</h1>
      {state !== LoadState.Loaded && <p>Loading courses…</p>}
      <ul className="space-y-2">
        {courses.map(c => (
          <li key={c.id}>
            <button
              className="w-full text-left p-4 bg-white rounded shadow hover:bg-blue-50"
              onClick={() => router.push(`/players?course_id=${c.id}`)}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
      {courses.length === 0 && state === LoadState.Loaded && (
        <div className="text-sm text-gray-600">No courses found. Make sure you seeded at least one course & tee in Supabase.</div>
      )}
    </div>
  );
}
