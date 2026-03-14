import { timingSafeEqual } from "node:crypto";

export class AdminAuthError extends Error {
  status: 401;

  constructor(message = "unauthorized") {
    super(message);
    this.name = "AdminAuthError";
    this.status = 401;
  }
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

export function assertAdminRequest(request: Request): void {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) {
    throw new AdminAuthError("admin api key is not configured");
  }

  const provided = request.headers.get("x-admin-key");
  if (!provided || !safeCompare(provided, configured)) {
    throw new AdminAuthError();
  }
}
