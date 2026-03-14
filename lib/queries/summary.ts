import type { SupabaseClient } from "@supabase/supabase-js";

type SessionSummaryRow = {
  performed_at: string;
  sets:
    | {
        weight: number | null;
        reps: number | null;
      }[]
    | null;
};

export type MonthlySummary = {
  current: {
    dayCount: number;
    totalVolume: number;
  };
  previous: {
    dayCount: number;
    totalVolume: number;
  };
};

export async function getMonthlySummaryByUser(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<MonthlySummary> {
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const currentMonthKey = `${currentMonthStart.getUTCFullYear()}-${String(currentMonthStart.getUTCMonth() + 1).padStart(2, "0")}`;
  const previousMonthKey = `${previousMonthStart.getUTCFullYear()}-${String(previousMonthStart.getUTCMonth() + 1).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("sessions")
    .select("performed_at, sets(weight, reps)")
    .eq("user_id", userId)
    .gte("performed_at", previousMonthStart.toISOString())
    .lt("performed_at", nextMonthStart.toISOString());

  if (error) {
    throw new Error(error.message);
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

  return {
    current: {
      dayCount: summary.current.days.size,
      totalVolume: summary.current.totalVolume,
    },
    previous: {
      dayCount: summary.previous.days.size,
      totalVolume: summary.previous.totalVolume,
    },
  };
}
