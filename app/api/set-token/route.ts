import { NextRequest, NextResponse } from "next/server";

const OUTSETA_COOKIE_NAME = "outseta_access_token";
const OUTSETA_COOKIE_MAX_AGE = 60 * 60 * 4; // 4 hours

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `${OUTSETA_COOKIE_NAME}=${encodeURIComponent(
      token,
    )}; Path=/; SameSite=None; Secure; HttpOnly; Max-Age=${OUTSETA_COOKIE_MAX_AGE}; Priority=High`,
  );
  return res;
}
