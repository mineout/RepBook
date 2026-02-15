import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 8;

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
  let query = supabase
    .from("sessions")
    .select(
      `id, performed_at, muscle_group, note, perceived_intensity, ` +
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

  const normalized = (data ?? []).map((session) => {
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
      perceivedIntensity: session.perceived_intensity,
      setCount,
      totalVolume,
      topSet,
      sets: normalizedSets,
    };
  });

  const filtered = exerciseFilter
    ? normalized.filter((session) =>
        session.exerciseName.toLowerCase().includes(exerciseFilter.toLowerCase()),
      )
    : normalized;

  const hasMore = (data?.length ?? 0) === limit;

  return NextResponse.json({ sessions: filtered, hasMore });
}
