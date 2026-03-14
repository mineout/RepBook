import { NextResponse } from "next/server";
import { listExerciseNamesByUser } from "@/lib/queries/exercises";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const userId = process.env.SUPABASE_DEFAULT_USER_ID;

  if (!userId) {
    return NextResponse.json({ error: "SUPABASE_DEFAULT_USER_ID 환경 변수를 설정하세요." }, { status: 500 });
  }

  try {
    const supabase = createServiceClient();
    const exercises = await listExerciseNamesByUser(supabase, userId);
    return NextResponse.json({ exercises });
  } catch (error) {
    const message = error instanceof Error ? error.message : "운동 목록 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
