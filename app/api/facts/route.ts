import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { verifyOutsetaToken } from "@/lib/verifyOutsetaToken"; // same pattern as create-session

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env vars");
}

function getAuthHeader(): string | null {
  const h = headers();
  const auth = h.get("authorization") || h.get("Authorization");
  return auth ?? null;
}

// Find or create user and business rows based on Outseta sub
async function resolveBusinessId(sub: string, supabase: any) {
  let { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("outseta_uid", sub)
    .maybeSingle();

  if (userErr) throw userErr;
  if (!userRow) {
    const { data, error } = await supabase
      .from("users")
      .insert({ outseta_uid: sub })
      .select("id")
      .single();
    if (error) throw error;
    userRow = data;
  }

  let { data: bizRow, error: bizErr } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userRow.id)
    .maybeSingle();
  if (bizErr) throw bizErr;
  if (!bizRow) {
    const { data, error } = await supabase
      .from("businesses")
      .insert({ user_id: userRow.id, name: "Default" })
      .select("id")
      .single();
    if (error) throw error;
    bizRow = data;
  }

  return bizRow.id as string;
}

export async function GET() {
  try {
    const auth = getAuthHeader();
    if (!auth) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

    const token = auth.replace(/^Bearer\s+/i, "");
    const payload = await verifyOutsetaToken(token);
    if (!payload?.sub) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const businessId = await resolveBusinessId(payload.sub as string, supabase);

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

export async function POST(req: Request) {
  try {
    const auth = getAuthHeader();
    if (!auth) return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });

    const token = auth.replace(/^Bearer\s+/i, "");
    const payload = await verifyOutsetaToken(token);
    if (!payload?.sub) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fact_id = typeof body?.fact_id === "string" ? body.fact_id.trim() : "";
    const fact_text = typeof body?.fact_text === "string" ? body.fact_text.trim() : "";
    const source_workflow = typeof body?.source_workflow === "string" ? body.source_workflow.trim() : null;

    if (!fact_id || !fact_text) {
      return NextResponse.json({ error: "fact_id and fact_text are required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const businessId = await resolveBusinessId(payload.sub as string, supabase);

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
