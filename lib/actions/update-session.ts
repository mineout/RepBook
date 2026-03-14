"use server";

import { revalidatePath } from "next/cache";
import { logActionFailure } from "@/lib/actions/action-diagnostics";
import { createServiceClient } from "@/lib/supabase/server";
import type { SaveExercisePayload } from "@/lib/actions/save-exercise";

export type UpdateSessionPayload = SaveExercisePayload & {
  sessionId: string;
};

export async function updateSession(payload: UpdateSessionPayload) {
  let stage = "validate-payload";

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

    stage = "select-session";
    const { data: sessionRow, error: sessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", payload.sessionId)
      .eq("user_id", userId)
      .single();

    if (sessionError || !sessionRow) {
      throw new Error("수정하려는 세션을 찾을 수 없습니다.");
    }

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

      if (insertExerciseError || !insertedExercise) {
        throw new Error(insertExerciseError?.message ?? "운동 정보를 생성하지 못했습니다.");
      }
      exerciseId = insertedExercise.id;
    }

    stage = "parse-session-date";
    const performedAt = new Date(payload.sessionDate);
    if (Number.isNaN(performedAt.getTime())) {
      throw new Error("유효한 날짜를 입력하세요.");
    }

    stage = "update-session";
    const { error: updateSessionError } = await supabase
      .from("sessions")
      .update({
        performed_at: performedAt.toISOString(),
        muscle_group: payload.muscleGroup,
        note: payload.note,
      })
      .eq("id", payload.sessionId)
      .eq("user_id", userId);

    if (updateSessionError) {
      throw new Error(updateSessionError.message);
    }

    stage = "delete-existing-sets";
    const { error: deleteSetsError } = await supabase.from("sets").delete().eq("session_id", payload.sessionId);
    if (deleteSetsError) {
      throw new Error(deleteSetsError.message);
    }

    stage = "insert-sets";
    const rows = payload.sets.map((set, index) => ({
      session_id: payload.sessionId,
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

    return { sessionId: payload.sessionId };
  } catch (error) {
    logActionFailure(
      {
        action: "updateSession",
        stage,
        userId: process.env.SUPABASE_DEFAULT_USER_ID,
        sessionId: payload.sessionId,
        payload,
      },
      error,
    );

    throw error;
  }
}
