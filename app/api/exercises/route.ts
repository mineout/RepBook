import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const userId = process.env.SUPABASE_DEFAULT_USER_ID;

  if (!userId) {
    return NextResponse.json({ error: "SUPABASE_DEFAULT_USER_ID 환경 변수를 설정하세요." }, { status: 500 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("name")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const suggestions = (Array.isArray(data) ? data : [])
    .map((row) => row.name?.trim())
    .filter((name): name is string => Boolean(name));

  return NextResponse.json({ exercises: suggestions.sort((a, b) => a.localeCompare(b)) });
}
