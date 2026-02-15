import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type RouteParams = {
  id?: string;
};

export async function DELETE(
  _request: Request,
  context: { params: Promise<RouteParams> | RouteParams },
) {
  const params = await context.params;
  const sessionId = params?.id;
  const userId = process.env.SUPABASE_DEFAULT_USER_ID;

  if (!sessionId) {
    return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "SUPABASE_DEFAULT_USER_ID 환경 변수를 설정하세요." }, { status: 500 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
