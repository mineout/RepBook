import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 8;

type SessionRow = {
  id: string;
  performed_at: string;
  muscle_group: string;
  note: string | null;
  sets: {
    weight: number | null;
    reps: number | null;
    exercise: { name: string | null } | null;
  }[] | null;
};

type NormalizedSession = {
  id: string;
  performedAt: string;
  muscleGroup: string;
  exerciseName: string;
  note: string | null;
  setCount: number;
  totalVolume: number;
  topSet: { weight: number | null; reps: number | null } | null;
  sets: { weight: number | null; reps: number | null }[];
};

function isSessionRow(value: unknown): value is SessionRow {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  const hasBaseFields =
    typeof candidate.id === "string" &&
    typeof candidate.performed_at === "string" &&
    typeof candidate.muscle_group === "string" &&
    (candidate.note === null || typeof candidate.note === "string");

  if (!hasBaseFields) return false;
  if (!(candidate.sets === null || Array.isArray(candidate.sets))) return false;

  if (Array.isArray(candidate.sets)) {
    const hasValidSets = candidate.sets.every((set) => {
      if (!set || typeof set !== "object") return false;
      const setRecord = set as Record<string, unknown>;
      const exercise = setRecord.exercise;

      return (
        (setRecord.weight === null || typeof setRecord.weight === "number") &&
        (setRecord.reps === null || typeof setRecord.reps === "number") &&
        (exercise === null ||
          (typeof exercise === "object" &&
            exercise !== null &&
            ((exercise as Record<string, unknown>).name === null ||
              typeof (exercise as Record<string, unknown>).name === "string")))
      );
    });

    if (!hasValidSets) return false;
  }

  return true;
}

function parseSessionRows(data: unknown): SessionRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isSessionRow);
}

function normalizeSessions(rows: SessionRow[]): NormalizedSession[] {
  return rows.map((session) => {
    const sets = session.sets ?? [];
    const setCount = sets.length;
    const totalVolume = sets.reduce((sum, set) => {
      const weight = Number(set.weight) || 0;
      const reps = Number(set.reps) || 0;
      return sum + weight * reps;
    }, 0);

    const normalizedSets = sets.map((set) => ({
      weight: Number(set.weight) || null,
      reps: Number(set.reps) || null,
    }));

    const topSet = normalizedSets.reduce<{ weight: number | null; reps: number | null } | null>(
      (top, set) => {
        const weight = set.weight ?? 0;
        if (!top || weight > (top.weight ?? 0)) {
          return { weight, reps: set.reps };
        }
        return top;
      },
      null,
    );

    const exerciseName =
      sets.find((set) => set.exercise?.name)?.exercise?.name ?? "기록된 운동";

    return {
      id: session.id,
      performedAt: session.performed_at,
      muscleGroup: session.muscle_group,
      exerciseName,
      note: session.note,
      setCount,
      totalVolume,
      topSet,
      sets: normalizedSets,
    };
  });
}

export async function GET(request: Request) {
  const userId = process.env.SUPABASE_DEFAULT_USER_ID;

  if (!userId) {
    return NextResponse.json({ error: "SUPABASE_DEFAULT_USER_ID 환경 변수를 설정하세요." }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || DEFAULT_LIMIT, 20);
  const offset = Number(url.searchParams.get("offset")) || 0;
  const muscleGroupFilter = url.searchParams.get("muscleGroup");
  const exerciseFilter = url.searchParams.get("exerciseName");

  const supabase = createServiceClient();

  if (exerciseFilter) {
    const { data: exerciseRows, error: exerciseError } = await supabase
      .from("exercises")
      .select("id")
      .ilike("name", `%${exerciseFilter}%`)
      .or(`user_id.eq.${userId},user_id.is.null`);

    if (exerciseError) {
      return NextResponse.json({ error: exerciseError.message }, { status: 500 });
    }

    const exerciseIds = (exerciseRows ?? []).map((exercise) => exercise.id);
    if (!exerciseIds.length) {
      return NextResponse.json({ sessions: [], hasMore: false });
    }

    const { data: setRows, error: setError } = await supabase
      .from("sets")
      .select("session_id")
      .in("exercise_id", exerciseIds);

    if (setError) {
      return NextResponse.json({ error: setError.message }, { status: 500 });
    }

    const sessionIds = Array.from(new Set((setRows ?? []).map((setRow) => setRow.session_id)));
    if (!sessionIds.length) {
      return NextResponse.json({ sessions: [], hasMore: false });
    }

    let countQuery = supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("id", sessionIds);

    if (muscleGroupFilter) {
      countQuery = countQuery.eq("muscle_group", muscleGroupFilter);
    }

    const { count, error: countError } = await countQuery;
    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    let pageQuery = supabase
      .from("sessions")
      .select(
        `id, performed_at, muscle_group, note, ` +
          `sets(weight, reps, exercise:exercise_id(name))`,
      )
      .eq("user_id", userId)
      .in("id", sessionIds);

    if (muscleGroupFilter) {
      pageQuery = pageQuery.eq("muscle_group", muscleGroupFilter);
    }

    const { data: pagedRows, error: pageError } = await pageQuery
      .order("performed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (pageError) {
      return NextResponse.json({ error: pageError.message }, { status: 500 });
    }

    const normalized = normalizeSessions(parseSessionRows(pagedRows));
    const hasMore = (count ?? 0) > offset + normalized.length;

    return NextResponse.json({ sessions: normalized, hasMore });
  }

  let query = supabase
    .from("sessions")
    .select(
      `id, performed_at, muscle_group, note, ` +
        `sets(weight, reps, exercise:exercise_id(name))`,
    )
    .eq("user_id", userId);

  if (muscleGroupFilter) {
    query = query.eq("muscle_group", muscleGroupFilter);
  }

  const { data, error } = await query
    .order("performed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = parseSessionRows(data);

  const normalized = normalizeSessions(rows);

  const hasMore = rows.length === limit;

  return NextResponse.json({ sessions: normalized, hasMore });
}
