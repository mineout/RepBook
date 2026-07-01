import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const expectedKey = process.env.KEEPALIVE_API_KEY;

  if (!expectedKey) {
    return NextResponse.json(
      { error: "KEEPALIVE_API_KEY 환경 변수를 설정하세요." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }

  const providedKey = request.headers.get("x-keepalive-key");

  if (providedKey !== expectedKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("sessions").select("id").limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supabase keepalive 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
