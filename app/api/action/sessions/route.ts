import { NextResponse } from "next/server";
import { ActionTokenError, resolveUserIdFromShareToken } from "@/lib/auth/share-token";
import { listSessionsByUser } from "@/lib/queries/sessions";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const limit = Number(url.searchParams.get("limit")) || undefined;
  const offset = Number(url.searchParams.get("offset")) || undefined;
  const muscleGroup = url.searchParams.get("muscleGroup");
  const exerciseName = url.searchParams.get("exerciseName");

  try {
    const supabase = createServiceClient();
    const userId = await resolveUserIdFromShareToken(supabase, token ?? "");
    const result = await listSessionsByUser(supabase, userId, {
      limit,
      offset,
      filters: {
        muscleGroup,
        exerciseName,
      },
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    if (error instanceof ActionTokenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "세션 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
