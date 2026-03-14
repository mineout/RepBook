import type { SupabaseClient } from "@supabase/supabase-js";

export async function listExerciseNamesByUser(
  supabase: SupabaseClient,
  userId: string,
  query?: string | null,
): Promise<string[]> {
  let dbQuery = supabase
    .from("exercises")
    .select("name")
    .eq("user_id", userId)
    .order("name");

  const trimmed = query?.trim();
  if (trimmed) {
    dbQuery = dbQuery.ilike("name", `%${trimmed}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(error.message);
  }

  const suggestions = (Array.isArray(data) ? data : [])
    .map((row) => row.name?.trim())
    .filter((name): name is string => Boolean(name));

  return suggestions.sort((a, b) => a.localeCompare(b));
}
