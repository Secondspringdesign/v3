import { NextResponse } from "next/server";

export async function GET() {
  const vercelEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
  const branch = process.env.VERCEL_GIT_COMMIT_REF || "unknown";
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const match = supabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : null;

  return NextResponse.json({
    vercelEnv,           // "preview" for staging, "production" for prod
    branch,              // should be "staging" or "main"
    supabase: {
      projectRef,        // the Supabase project/branch reference from SUPABASE_URL
      urlMasked: projectRef ? `https://${projectRef}.supabase.co` : null,
      hasAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
}
