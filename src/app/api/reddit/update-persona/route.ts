import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Optional endpoint to update a persona based on Reddit data analysis
 * Only enabled when REDDIT_INGEST_ENABLED=true
 * This would typically be called after ingesting Reddit data
 */
export async function POST(request: NextRequest) {
  const isEnabled = process.env.REDDIT_INGEST_ENABLED === "true";

  if (!isEnabled) {
    return NextResponse.json(
      { error: "Reddit ingestion is disabled. Set REDDIT_INGEST_ENABLED=true to enable." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { subredditId, updates } = body;

    if (!subredditId || typeof subredditId !== "string") {
      return NextResponse.json(
        { error: "subredditId is required" },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "updates object is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 }
      );
    }

    // Update persona with new data
    // Only update fields that are provided
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.tone) updateData.tone = updates.tone;
    if (updates.norms) updateData.norms = updates.norms;
    if (updates.failure_triggers) updateData.failure_triggers = updates.failure_triggers;
    if (updates.example_phrases) updateData.example_phrases = updates.example_phrases;

    const { data, error } = await supabase
      .from("subreddit_personas")
      .update(updateData)
      .eq("subreddit_id", subredditId)
      .select()
      .single();

    if (error) {
      console.error("Error updating persona:", error);
      return NextResponse.json(
        { error: "Failed to update persona", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      persona: data,
      message: `Updated persona for ${subredditId}`,
    });
  } catch (error) {
    console.error("Update persona error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
