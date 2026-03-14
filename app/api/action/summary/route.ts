import { NextResponse } from "next/server";
import { ActionTokenError, resolveUserIdFromShareToken } from "@/lib/auth/share-token";
import { getMonthlySummaryByUser } from "@/lib/queries/summary";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  try {
    const supabase = createServiceClient();
    const userId = await resolveUserIdFromShareToken(supabase, token ?? "");
    const summary = await getMonthlySummaryByUser(supabase, userId);

    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    if (error instanceof ActionTokenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "요약 조회 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
