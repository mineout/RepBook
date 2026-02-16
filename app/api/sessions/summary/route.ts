import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type SessionSummaryRow = {
  performed_at: string;
  sets:
    | {
        weight: number | null;
        reps: number | null;
      }[]
    | null;
};

export async function GET() {
  const userId = process.env.SUPABASE_DEFAULT_USER_ID;

  if (!userId) {
    return NextResponse.json({ error: "SUPABASE_DEFAULT_USER_ID 환경 변수를 설정하세요." }, { status: 500 });
  }

  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const currentMonthKey = `${currentMonthStart.getUTCFullYear()}-${String(currentMonthStart.getUTCMonth() + 1).padStart(2, "0")}`;
  const previousMonthKey = `${previousMonthStart.getUTCFullYear()}-${String(previousMonthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("performed_at, sets(weight, reps)")
    .eq("user_id", userId)
    .gte("performed_at", previousMonthStart.toISOString())
    .lt("performed_at", nextMonthStart.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? (data as unknown as SessionSummaryRow[]) : [];

  const summary = {
    current: { days: new Set<string>(), totalVolume: 0 },
    previous: { days: new Set<string>(), totalVolume: 0 },
  };

  rows.forEach((session) => {
    const date = new Date(session.performed_at);
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const volume = (session.sets ?? []).reduce((sum, set) => {
      const weight = Number(set.weight) || 0;
      const reps = Number(set.reps) || 0;
      return sum + weight * reps;
    }, 0);

    if (monthKey === currentMonthKey) {
      summary.current.days.add(session.performed_at.slice(0, 10));
      summary.current.totalVolume += volume;
      return;
    }

    if (monthKey === previousMonthKey) {
      summary.previous.days.add(session.performed_at.slice(0, 10));
      summary.previous.totalVolume += volume;
    }
  });

  return NextResponse.json({
    current: {
      dayCount: summary.current.days.size,
      totalVolume: summary.current.totalVolume,
    },
    previous: {
      dayCount: summary.previous.days.size,
      totalVolume: summary.previous.totalVolume,
    },
  });
}
