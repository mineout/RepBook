import test from "node:test";
import assert from "node:assert/strict";
import { AdminAuthError, assertAdminRequest } from "./admin.ts";

test("assertAdminRequest allows valid admin key", () => {
  process.env.ADMIN_API_KEY = "secret-key";
  const request = new Request("http://localhost/api/admin/action-token", {
    headers: {
      "x-admin-key": "secret-key",
    },
  });

  assert.doesNotThrow(() => assertAdminRequest(request));
});

test("assertAdminRequest rejects invalid admin key", () => {
  process.env.ADMIN_API_KEY = "secret-key";
  const request = new Request("http://localhost/api/admin/action-token", {
    headers: {
      "x-admin-key": "wrong",
    },
  });

  assert.throws(
    () => assertAdminRequest(request),
    (error) => error instanceof AdminAuthError && error.status === 401,
  );
});
