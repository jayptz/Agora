import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { subreddits } from "@/data/subreddits";

/**
 * Admin endpoint to seed personas from static data into Supabase
 * Secured by ADMIN_SECRET environment variable
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin secret
    const adminSecret = request.headers.get("x-admin-secret");
    const expectedSecret = process.env.ADMIN_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { error: "ADMIN_SECRET not configured" },
        { status: 500 }
      );
    }

    if (adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // Upsert all personas
    const upserts = subreddits.map((sub) => ({
      subreddit_id: sub.id,
      name: sub.name,
      tone: sub.tone,
      norms: sub.norms,
      failure_triggers: sub.failureTriggers,
      example_phrases: sub.examplePhrases,
    }));

    const { data, error } = await supabase
      .from("subreddit_personas")
      .upsert(upserts as any, {
        onConflict: "subreddit_id",
      })
      .select();

    if (error) {
      console.error("Error seeding personas:", error);
      return NextResponse.json(
        { error: "Failed to seed personas", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("Seed personas error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
