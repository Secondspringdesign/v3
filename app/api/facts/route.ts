import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyOutsetaToken } from "@/lib/outseta";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars");
}

function getAuthHeaderFromRequest(request: Request): string | null {
  const auth =
    request.headers.get("authorization") || request.headers.get("Authorization");
  return auth ?? null;
}

function createServiceClient(): SupabaseClient {
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveBusinessId(sub: string, supabase: SupabaseClient) {
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("outseta_uid", sub)
    .maybeSingle();
  if (userErr) throw userErr;

  let ensuredUser = userRow;
  if (!ensuredUser) {
    const { data, error } = await supabase
      .from("users")
      .insert({ outseta_uid: sub })
      .select("id")
      .single();
    if (error) throw error;
    ensuredUser = data;
  }

  const { data: bizRow, error: bizErr } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", ensuredUser.id)
    .maybeSingle();
  if (bizErr) throw bizErr;

  let ensuredBiz = bizRow;
  if (!ensuredBiz) {
    const { data, error } = await supabase
      .from("businesses")
      .insert({ user_id: ensuredUser.id, name: "Default" })
      .select("id")
      .single();
    if (error) throw error;
    ensuredBiz = data;
  }

  return ensuredBiz.id as string;
}

async function verifyOrFail(token: string) {
  const payload = await verifyOutsetaToken(token);
  if (!payload?.payload?.sub || !payload.verified) {
    console.error("verifyOutsetaToken failed", {
      verified: payload?.verified,
      payload: payload?.payload,
    });
    return null;
  }
  return payload.payload.sub as string;
}

export async function GET(request: Request) {
  try {
    const auth = getAuthHeaderFromRequest(request);
    if (!auth) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

    const token = auth.replace(/^Bearer\s+/i, "");
    const sub = await verifyOrFail(token);
    if (!sub) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const supabase = createServiceClient();
    const businessId = await resolveBusinessId(sub, supabase);

    const { data, error } = await supabase
      .from("facts")
      .select("id, fact_id, fact_text, source_workflow, created_at, updated_at")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, facts: data ?? [] });
  } catch (e) {
    console.error("/api/facts GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthHeaderFromRequest(request);
    if (!auth) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

    const token = auth.replace(/^Bearer\s+/i, "");
    const sub = await verifyOrFail(token);
    if (!sub) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const fact_id = typeof body?.fact_id === "string" ? body.fact_id.trim() : "";
    const fact_text = typeof body?.fact_text === "string" ? body.fact_text.trim() : "";
    const source_workflow =
      typeof body?.source_workflow === "string" ? body.source_workflow.trim() : null;

    if (!fact_id || !fact_text) {
      return NextResponse.json({ error: "fact_id and fact_text are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const businessId = await resolveBusinessId(sub, supabase);

    const { data, error } = await supabase
      .from("facts")
      .upsert(
        { business_id: businessId, fact_id, fact_text, source_workflow },
        { onConflict: "business_id,fact_id" }
      )
      .select("id, fact_id, fact_text, source_workflow, created_at, updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, fact: data });
  } catch (e) {
    console.error("/api/facts POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
