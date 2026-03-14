import test from "node:test";
import assert from "node:assert/strict";
import {
  ActionTokenError,
  assertTokenIsNotExpired,
  normalizeTokenOrThrow,
  resolveUserIdFromShareToken,
} from "./share-token.ts";

test("normalizeTokenOrThrow trims token", () => {
  assert.equal(normalizeTokenOrThrow("  abc  "), "abc");
});

test("normalizeTokenOrThrow throws 400 for empty token", () => {
  assert.throws(
    () => normalizeTokenOrThrow("   "),
    (error) => error instanceof ActionTokenError && error.status === 400,
  );
});

test("assertTokenIsNotExpired throws 403 for expired token", () => {
  assert.throws(
    () => assertTokenIsNotExpired("2026-01-01T00:00:00.000Z", new Date("2026-02-01T00:00:00.000Z")),
    (error) => error instanceof ActionTokenError && error.status === 403,
  );
});

test("resolveUserIdFromShareToken returns user_id for valid token", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: {
                    user_id: "user-123",
                    expires_at: "2099-01-01T00:00:00.000Z",
                  },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  };

  const userId = await resolveUserIdFromShareToken(supabase as never, "token-value");
  assert.equal(userId, "user-123");
});

test("resolveUserIdFromShareToken throws 401 for unknown token", async () => {
  const supabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () => resolveUserIdFromShareToken(supabase as never, "token-value"),
    (error) => error instanceof ActionTokenError && error.status === 401,
  );
});
