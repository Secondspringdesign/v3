import { NextResponse } from "next/server";

export async function GET() {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
  const branch = process.env.VERCEL_GIT_COMMIT_REF || "unknown";

  // Prefer server-only vars; fall back to public if those aren't set
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  const hasAnonKey =
    Boolean(process.env.SUPABASE_ANON_KEY) ||
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const match = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : null;

  return NextResponse.json({
    vercelEnv,
    branch,
    supabase: {
      projectRef,
      urlMasked: projectRef ? `https://${projectRef}.supabase.co` : null,
      hasAnonKey,
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
}
