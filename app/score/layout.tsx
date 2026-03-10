"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Player = {
  id: string;
  player_name: string;
  handicap_index: number;
  playing_handicap: number;
};

type TeeRow = {
  id: string;
  tee_name: string;
  par: number[];
  stroke_index: number[];
  yardage: number[];
  metres: number[];
  course_rating: number;
  slope_rating: number;
  course_par: number;
};

type ScoreMap = { [playerId: string]: { [hole: number]: number | undefined } };

// Default strokes now 0
const DEFAULT_STROKES = 0;

// Competition allowance
const ALLOWANCE = 0.95;

// Base domain for sharing
const BASE_URL = "https://golf-scoring-app-omega.vercel.app";

export default function ScoreClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const competitionId = sp.get("competition_id");

  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<ScoreMap>({});
  const [tee, setTee] = useState<TeeRow | null>(null);

  // Initialize hole from query
  const initialHole = useMemo(() => {
    const h = Number(sp.get("hole") || "1");
    return Number.isFinite(h) && h >= 1 && h <= 18 ? h : 1;
  }, [sp]);

  const [currentHole, setCurrentHole] = useState<number>(initialHole);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const holePar = tee?.par?.[currentHole - 1] ?? null;
  const holeSI = tee?.stroke_index?.[currentHole - 1] ?? null;

  // Sync hole with URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("hole", String(currentHole));
    if (competitionId) {
      url.searchParams.set("competition_id", competitionId);
    }
    router.replace(`${url.pathname}?${url.searchParams.toString()}`);
  }, [currentHole, competitionId, router]);

  // Calculate Course Handicap
  function getCourseHandicap(
    handicapIndex: number | null | undefined,
    teeRow: TeeRow | null
  ): number | null {
    if (handicapIndex == null || !teeRow) return null;
    const ch =
      handicapIndex * (teeRow.slope_rating / 113) +
      (teeRow.course_rating - teeRow.course_par);
    return Math.round(ch);
  }

  // Playing handicap (95%)
  function getPlayingHandicapFromCH(courseHandicap: number | null): number | null {
    if (courseHandicap == null) return null;
    return Math.round(courseHandicap * ALLOWANCE);
  }

  // Load players, tee, and existing scores
  useEffect(() => {
    if (!competitionId) return;
    let cancelled = false;

    (async () => {
      // Players
      const { data: playersData } = await supabase
        .from("players")
        .select("id, player_name, handicap_index, playing_handicap, tee_id")
        .eq("competition_id", competitionId)
        .order("created_at");

      if (!cancelled) {
        setPlayers(playersData ?? []);
      }

      // Score entries
      const { data: entryData } = await supabase
        .from("score_entries")
        .select("player_id, hole_number, strokes")
        .eq("competition_id", competitionId);

      if (!cancelled) {
        const map: ScoreMap = {};
        (entryData ?? []).forEach((r) => {
          if (!map[r.player_id]) map[r.player_id] = {};
          map[r.player_id][r.hole_number] = r.strokes ?? undefined;
        });
        setScores(map);
      }

      // Tee ID
      const { data: compRow } = await supabase
        .from("competitions")
        .select("tee_id")
        .eq("id", competitionId)
        .single();

      if (!compRow?.tee_id) return;

      // Tee meta
      const { data: teeRow } = await supabase
        .from("tees")
        .select(
          "id, tee_name, par, stroke_index, yardage, metres, course_rating, slope_rating, course_par"
        )
        .eq("id", compRow.tee_id)
        .single();

      if (!cancelled && teeRow) {
        setTee(teeRow as TeeRow);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  // Hole navigation
  const nextHole = useCallback(() => {
    setCurrentHole((h) => (h % 18) + 1);
  }, []);

  const prevHole = useCallback(() => {
    setCurrentHole((h) => ((h - 2 + 18) % 18) + 1);
  }, []);

  // Manual stroke entry
  function setStroke(playerId: string, value: string) {
    const trimmed = value.trim();
    const n = trimmed === "" ? undefined : Number(trimmed);
    const safe =
      Number.isFinite(n as number) && (n as number) >= 0
        ? (n as number)
        : undefined;

    setScores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [currentHole]: safe },
    }));
  }

  // +/- buttons
  function adjustStroke(playerId: string, delta: number) {
    const current = scores[playerId]?.[currentHole];
    const next = Math.max(0, (current ?? DEFAULT_STROKES) + delta);
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? {}), [currentHole]: next },
    }));
  }

  async function saveHole() {
    if (!competitionId) return;

    const payloads = players.map((p) => ({
      player_id: p.id,
      strokes: scores[p.id]?.[currentHole] ?? DEFAULT_STROKES,
    }));

    await Promise.all(
      payloads.map((rec) =>
        fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competition_id: competitionId,
            player_id: rec.player_id,
            hole_number: currentHole,
            strokes: rec.strokes,
          }),
        })
      )
    );
  }

  async function handleNext() {
    await saveHole();
    nextHole();
  }

  async function handlePrev() {
    await saveHole();
    prevHole();
  }

  async function handleFinish() {
    await saveHole();
    setShowFinishConfirm(false);
    router.push(`/leaderboard?competition_id=${competitionId}`);
  }

  // WHS strokes received
  function getShotsReceived(playingHandicap: number, si: number | null): number {
    if (si == null || playingHandicap <= 0) return 0;
    const base = Math.floor(playingHandicap / 18);
    const extras = playingHandicap % 18;
    return base + (si <= extras ? 1 : 0);
  }

  function getStablefordPoints(nett: number | null): number {
    if (nett == null) return 0;
    if (nett <= -3) return 5;
    if (nett === -2) return 4;
    if (nett === -1) return 3;
    if (nett === 0) return 2;
    if (nett === 1) return 1;
    return 0;
  }

  function getCumulativePointsUpTo(
    playerId: string,
    uptoHole: number,
    teeRow: TeeRow | null,
    scoreMap: ScoreMap,
    playingHandicap: number
  ): number {
    if (!teeRow) return 0;

    let total = 0;

    for (let h = 1; h <= uptoHole; h++) {
      const par = teeRow.par?.[h - 1] ?? null;
      const si = teeRow.stroke_index?.[h - 1] ?? null;
      const strokes = scoreMap[playerId]?.[h] ?? DEFAULT_STROKES;
      const shots = getShotsReceived(playingHandicap, si);
      const nettToPar = par != null ? (strokes - shots) - par : null;
      total += getStablefordPoints(nettToPar);
    }

    return total;
  }

  // --------------------------
