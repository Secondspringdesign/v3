import { NextResponse } from "next/server";
// TODO: adjust these imports to your actual helpers
import { getSupabaseClient } from "@/lib/supabase"; // or "@/lib/supabase/server"
import { getUserFromRequest } from "@/lib/auth";    // whatever you use to get the user

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Treat "no rows" as empty list
    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ documents: [] }, { status: 200 });
      }
      console.error("documents GET error", error);
      return NextResponse.json(
        { documents: [], error: "Failed to fetch documents", code: "DATABASE_ERROR" },
        { status: 200 } // soften to 200 so UI doesn't show a banner
      );
    }

    return NextResponse.json({ documents: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("documents GET unknown error", err);
    return NextResponse.json(
      { documents: [], error: "Failed to fetch documents", code: "DATABASE_ERROR" },
      { status: 200 } // soften to 200 for empty state
    );
  }
}
