import { NextResponse } from "next/server";
import { ActionTokenError, resolveUserIdFromShareToken } from "@/lib/auth/share-token";
import { listExerciseNamesByUser } from "@/lib/queries/exercises";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const query = url.searchParams.get("q");

  try {
    const supabase = createServiceClient();
    const userId = await resolveUserIdFromShareToken(supabase, token ?? "");
    const exercises = await listExerciseNamesByUser(supabase, userId, query);

    return NextResponse.json({ exercises }, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    if (error instanceof ActionTokenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "운동 목록 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
