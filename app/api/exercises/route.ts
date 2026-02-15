import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const userId = process.env.SUPABASE_DEFAULT_USER_ID;

  if (!userId) {
    return NextResponse.json({ error: "SUPABASE_DEFAULT_USER_ID 환경 변수를 설정하세요." }, { status: 500 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sets")
    .select("exercise:exercise_id(name), session:sessions!inner(user_id)")
    .eq("session.user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uniqueNames = new Set<string>();
  const suggestions: string[] = [];
  (data ?? []).forEach((row) => {
    const name = row.exercise?.name;
    if (name && !uniqueNames.has(name)) {
      uniqueNames.add(name);
      suggestions.push(name);
    }
  });

  return NextResponse.json({ exercises: suggestions.sort((a, b) => a.localeCompare(b)) });
}
