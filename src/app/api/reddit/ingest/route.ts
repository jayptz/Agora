import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Optional Reddit ingestion endpoint
 * Only enabled when REDDIT_INGEST_ENABLED=true
 * Uses official Reddit API to fetch recent posts from a subreddit
 * and update persona data based on actual community behavior
 */
export async function POST(request: NextRequest) {
  // Check if Reddit ingestion is enabled
  const isEnabled = process.env.REDDIT_INGEST_ENABLED === "true";

  if (!isEnabled) {
    return NextResponse.json(
      { error: "Reddit ingestion is disabled. Set REDDIT_INGEST_ENABLED=true to enable." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { subredditId, limit = 10 } = body;

    if (!subredditId || typeof subredditId !== "string") {
      return NextResponse.json(
        { error: "subredditId is required" },
        { status: 400 }
      );
    }

    // Fetch from Reddit API (official, no scraping)
    // Reddit API: https://www.reddit.com/r/{subreddit}/hot.json?limit={limit}
    const redditUrl = `https://www.reddit.com/r/${subredditId}/hot.json?limit=${Math.min(limit, 100)}`;
    
    const response = await fetch(redditUrl, {
      headers: {
        "User-Agent": "AgoraSim/1.0 (by /u/yourusername)", // Reddit requires User-Agent
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Reddit API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const posts = data.data?.children?.map((child: any) => child.data) || [];

    // Analyze posts to extract patterns (simplified)
    // In a full implementation, you'd use LLM or NLP to extract:
    // - Common phrases
    // - Tone patterns
    // - What gets upvoted vs downvoted
    const analysis = {
      totalPosts: posts.length,
      avgScore: posts.reduce((sum: number, p: any) => sum + (p.score || 0), 0) / posts.length,
      avgUpvoteRatio: posts.reduce((sum: number, p: any) => sum + (p.upvote_ratio || 0), 0) / posts.length,
      sampleTitles: posts.slice(0, 5).map((p: any) => p.title),
    };

    // Optionally update persona in Supabase based on analysis
    // This is a placeholder - full implementation would use LLM to extract norms
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // For now, just log that we could update
      // In production, you'd analyze posts and update norms/failure_triggers
      console.log(`Ingested ${posts.length} posts from r/${subredditId}`);
    }

    return NextResponse.json({
      success: true,
      subredditId,
      postsAnalyzed: posts.length,
      analysis,
      message: "Reddit data ingested successfully. Persona update logic can be implemented here.",
    });
  } catch (error) {
    console.error("Reddit ingestion error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if Reddit ingestion is enabled
 */
export async function GET() {
  const isEnabled = process.env.REDDIT_INGEST_ENABLED === "true";
  
  return NextResponse.json({
    enabled: isEnabled,
    message: isEnabled
      ? "Reddit ingestion is enabled"
      : "Reddit ingestion is disabled. Set REDDIT_INGEST_ENABLED=true to enable.",
  });
}
