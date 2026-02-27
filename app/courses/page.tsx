'use client';
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Course = { id: string; name: string };

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const router = useRouter();

  useEffect(() => {
    supabase.from("courses").select("id,name").order("name")
      .then(({ data }) => setCourses(data ?? []));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Select Course</h1>
      <ul className="space-y-2">
        {courses.map((c) => (
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
    </div>
  );
}
