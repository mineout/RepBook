"use server";

import { revalidatePath } from "next/cache";
import { logActionFailure } from "@/lib/actions/action-diagnostics";
import { createServiceClient } from "@/lib/supabase/server";

type SetPayload = {
  weight: string;
  reps: string;
};

export type SaveExercisePayload = {
  sessionDate: string;
  muscleGroup: string;
  exerciseName: string;
  note: string;
  sets: SetPayload[];
};

const DEMO_EMAIL_FALLBACK = "demo@repbook.local";

export async function saveExercise(payload: SaveExercisePayload) {
  let stage = "validate-payload";
  let sessionId: string | undefined;

  try {
    if (!payload.sets.length) {
      throw new Error("최소 1개 이상의 세트를 입력해야 합니다.");
    }

    const userId = process.env.SUPABASE_DEFAULT_USER_ID;
    if (!userId) {
      throw new Error("SUPABASE_DEFAULT_USER_ID 환경 변수를 확인하세요.");
    }

    stage = "create-service-client";
    const supabase = createServiceClient();

    stage = "upsert-profile";
    await supabase.from("profiles").upsert({
      id: userId,
      email: process.env.SUPABASE_DEFAULT_USER_EMAIL ?? DEMO_EMAIL_FALLBACK,
      display_name: "RepBook 사용자",
    });

    const exerciseName = payload.exerciseName.trim();
    if (!exerciseName) {
      throw new Error("운동 이름을 입력하세요.");
    }

    stage = "select-exercise";
    const { data: existingExercise, error: selectExerciseError } = await supabase
      .from("exercises")
      .select("id")
      .eq("user_id", userId)
      .eq("name", exerciseName)
      .maybeSingle();

    if (selectExerciseError) {
      throw new Error(selectExerciseError.message);
    }

    let exerciseId = existingExercise?.id;

    if (!exerciseId) {
      stage = "insert-exercise";
      const { data: insertedExercise, error: insertExerciseError } = await supabase
        .from("exercises")
        .insert({
          name: exerciseName,
          muscle_group: payload.muscleGroup,
          user_id: userId,
        })
        .select("id")
        .single();

      if (insertExerciseError) {
        throw new Error(insertExerciseError.message);
      }

      exerciseId = insertedExercise.id;
    }

    stage = "parse-session-date";
    const performedAt = new Date(payload.sessionDate);
    if (Number.isNaN(performedAt.getTime())) {
      throw new Error("유효한 날짜를 입력하세요.");
    }

    stage = "insert-session";
    const { data: session, error: insertSessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        performed_at: performedAt.toISOString(),
        muscle_group: payload.muscleGroup,
        note: payload.note,
      })
      .select("id")
      .single();

    if (insertSessionError || !session) {
      throw new Error(insertSessionError?.message ?? "세션 저장 중 문제가 발생했습니다.");
    }

    sessionId = session.id;

    stage = "insert-sets";
    const rows = payload.sets.map((set, index) => ({
      session_id: session.id,
      exercise_id: exerciseId,
      weight: Number(set.weight) || null,
      reps: Number(set.reps) || null,
      set_order: index + 1,
    }));

    const { error: insertSetsError } = await supabase.from("sets").insert(rows);
    if (insertSetsError) {
      throw new Error(insertSetsError.message);
    }

    stage = "revalidate-home";
    revalidatePath("/");

    return { sessionId: session.id };
  } catch (error) {
    logActionFailure(
      {
        action: "saveExercise",
        stage,
        userId: process.env.SUPABASE_DEFAULT_USER_ID,
        sessionId,
        payload,
      },
      error,
    );

    throw error;
  }
}
