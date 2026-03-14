import { NextResponse } from "next/server";
import {
  AdminActionTokenError,
  listActiveTokensByUser,
  parseTtlDays,
  parseUserId,
  revokeActiveTokensByUser,
  rotateActionToken,
} from "@/lib/admin/action-token";
import { AdminAuthError, assertAdminRequest } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function errorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: "unauthorized" }, { status: error.status, headers: NO_STORE_HEADERS });
  }

  if (error instanceof AdminActionTokenError) {
    return NextResponse.json({ error: error.message }, { status: error.status, headers: NO_STORE_HEADERS });
  }

  const message = error instanceof Error ? error.message : "internal server error";
  return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  try {
    assertAdminRequest(request);

    const userId = parseUserId(new URL(request.url).searchParams.get("userId"));
    const supabase = createServiceClient();
    const tokens = await listActiveTokensByUser(supabase, userId);

    return NextResponse.json({ tokens }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertAdminRequest(request);

    const body = (await request.json()) as Record<string, unknown>;
    const userId = parseUserId(body.userId);
    const ttlDays = parseTtlDays(body.ttlDays);

    const supabase = createServiceClient();
    const result = await rotateActionToken(supabase, { userId, ttlDays });

    return NextResponse.json(result, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertAdminRequest(request);

    const body = (await request.json()) as Record<string, unknown>;
    const userId = parseUserId(body.userId);

    const supabase = createServiceClient();
    const revokedCount = await revokeActiveTokensByUser(supabase, userId);

    return NextResponse.json({ revokedCount }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return errorResponse(error);
  }
}
