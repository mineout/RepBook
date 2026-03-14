import type { SupabaseClient } from "@supabase/supabase-js";

export class ActionTokenError extends Error {
  status: 400 | 401 | 403;

  constructor(message: string, status: 400 | 401 | 403) {
    super(message);
    this.name = "ActionTokenError";
    this.status = status;
  }
}

type ShareTokenRow = {
  user_id: string;
  expires_at: string;
};

export function normalizeTokenOrThrow(token: string | null): string {
  const normalized = token?.trim();
  if (!normalized) {
    throw new ActionTokenError("token query parameter is required", 400);
  }

  return normalized;
}

export function assertTokenIsNotExpired(expiresAt: string, now: Date = new Date()) {
  const expiresDate = new Date(expiresAt);
  if (Number.isNaN(expiresDate.getTime())) {
    throw new ActionTokenError("invalid token expiry state", 401);
  }

  if (expiresDate.getTime() <= now.getTime()) {
    throw new ActionTokenError("token expired", 403);
  }
}

export async function resolveUserIdFromShareToken(
  supabase: SupabaseClient,
  token: string,
): Promise<string> {
  const normalizedToken = normalizeTokenOrThrow(token);

  const { data, error } = await supabase
    .from("share_tokens")
    .select("user_id, expires_at")
    .eq("token", normalizedToken)
    .maybeSingle();

  if (error) {
    throw new ActionTokenError(error.message, 401);
  }

  if (!data) {
    throw new ActionTokenError("invalid token", 401);
  }

  const tokenRow = data as ShareTokenRow;
  assertTokenIsNotExpired(tokenRow.expires_at);

  return tokenRow.user_id;
}
