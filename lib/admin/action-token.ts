import type { SupabaseClient } from "@supabase/supabase-js";

export class AdminActionTokenError extends Error {
  status: 400 | 404 | 500;

  constructor(message: string, status: 400 | 404 | 500) {
    super(message);
    this.name = "AdminActionTokenError";
    this.status = status;
  }
}

type SessionRow = { id: string };

type ShareTokenRow = {
  token: string;
  expires_at: string;
  created_at: string;
};

export type RotateOptions = {
  userId: string;
  ttlDays?: number;
};

export function parseUserId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AdminActionTokenError("userId is required", 400);
  }

  return value.trim();
}

export function parseTtlDays(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 7;
  }

  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 30) {
    throw new AdminActionTokenError("ttlDays must be an integer between 1 and 30", 400);
  }

  return num;
}

export async function getLatestSessionIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", userId)
    .order("performed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AdminActionTokenError(error.message, 500);
  }

  if (!data || !(data as SessionRow).id) {
    throw new AdminActionTokenError("no session found for user", 404);
  }

  return (data as SessionRow).id;
}

export async function revokeActiveTokensByUser(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const nowIso = now.toISOString();

  const { data, error } = await supabase
    .from("share_tokens")
    .delete()
    .eq("user_id", userId)
    .gt("expires_at", nowIso)
    .select("token");

  if (error) {
    throw new AdminActionTokenError(error.message, 500);
  }

  return Array.isArray(data) ? data.length : 0;
}

export async function listActiveTokensByUser(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<Array<{ token: string; expiresAt: string; createdAt: string }>> {
  const nowIso = now.toISOString();

  const { data, error } = await supabase
    .from("share_tokens")
    .select("token, expires_at, created_at")
    .eq("user_id", userId)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AdminActionTokenError(error.message, 500);
  }

  const rows = Array.isArray(data) ? (data as ShareTokenRow[]) : [];

  return rows.map((row) => ({
    token: row.token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

export async function issueTokenForUser(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  ttlDays: number,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: string }> {
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("share_tokens")
    .insert({
      user_id: userId,
      session_id: sessionId,
      expires_at: expiresAt,
    })
    .select("token, expires_at")
    .single();

  if (error || !data) {
    throw new AdminActionTokenError(error?.message ?? "failed to issue token", 500);
  }

  return {
    token: (data as { token: string }).token,
    expiresAt: (data as { expires_at: string }).expires_at,
  };
}

export async function rotateActionToken(
  supabase: SupabaseClient,
  options: RotateOptions,
): Promise<{ token: string; expiresAt: string; revokedCount: number }> {
  const userId = parseUserId(options.userId);
  const ttlDays = parseTtlDays(options.ttlDays);

  const sessionId = await getLatestSessionIdForUser(supabase, userId);
  const revokedCount = await revokeActiveTokensByUser(supabase, userId);
  const issued = await issueTokenForUser(supabase, userId, sessionId, ttlDays);

  return {
    token: issued.token,
    expiresAt: issued.expiresAt,
    revokedCount,
  };
}
