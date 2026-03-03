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
