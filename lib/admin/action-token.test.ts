import test from "node:test";
import assert from "node:assert/strict";
import {
  AdminActionTokenError,
  parseTtlDays,
  parseUserId,
  rotateActionToken,
} from "./action-token.ts";

test("parseUserId returns trimmed user id", () => {
  assert.equal(parseUserId("  user-1  "), "user-1");
});

test("parseUserId throws for empty", () => {
  assert.throws(
    () => parseUserId("  "),
    (error) => error instanceof AdminActionTokenError && error.status === 400,
  );
});

test("parseTtlDays defaults to 7", () => {
  assert.equal(parseTtlDays(undefined), 7);
});

test("parseTtlDays throws for invalid range", () => {
  assert.throws(
    () => parseTtlDays(0),
    (error) => error instanceof AdminActionTokenError && error.status === 400,
  );
});

test("rotateActionToken revokes active token and issues new one", async () => {
  const calls: string[] = [];

  const supabase = {
    from(table: string) {
      if (table === "sessions") {
        calls.push("sessions");
        return {
          select() {
            return {
              eq() {
                return {
                  order() {
                    return {
                      order() {
                        return {
                          order() {
                            return {
                              limit() {
                                return {
                                  maybeSingle: async () => ({ data: { id: "session-1" }, error: null }),
                                };
                              },
                            };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "share_tokens") {
        return {
          delete() {
            return {
              eq() {
                return {
                  gt() {
                    return {
                      select: async () => ({ data: [{ token: "old" }], error: null }),
                    };
                  },
                };
              },
            };
          },
          insert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      token: "new-token",
                      expires_at: "2099-01-01T00:00:00.000Z",
                    },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  };

  const result = await rotateActionToken(supabase as never, { userId: "user-1", ttlDays: 7 });

  assert.equal(result.token, "new-token");
  assert.equal(result.revokedCount, 1);
  assert.ok(calls.includes("sessions"));
});
