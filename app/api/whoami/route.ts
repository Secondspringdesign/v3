import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || null;
  const cookieHeader = req.headers.get("cookie") || null;

  const cookies = cookieHeader
    ? Object.fromEntries(
        cookieHeader.split(";").map((c) => {
          const [k, ...rest] = c.trim().split("=");
          return [k, rest.join("=")];
        }),
      )
    : {};

  return NextResponse.json(
    {
      authorization: auth,
      cookies,
      message: "If authorization is null, the token never arrived at the server.",
    },
    { status: 200 },
  );
}
