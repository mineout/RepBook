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
    .select("id, name, muscle_group")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uniqueNames = new Map<string, { name: string; muscleGroup: string | null }>();
  (data ?? []).forEach((row) => {
    if (!uniqueNames.has(row.name)) {
      uniqueNames.set(row.name, { name: row.name, muscleGroup: row.muscle_group });
    }
  });

  return NextResponse.json({ exercises: Array.from(uniqueNames.values()) });
}
