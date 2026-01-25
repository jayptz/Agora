import { NextRequest, NextResponse } from "next/server";
import { simulatePost } from "@/lib/simulateCore";

const DEMO_SUBREDDITS = ["startups", "MachineLearning", "technology"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;
    
    // Validation
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required and cannot be empty" },
        { status: 400 }
      );
    }
    
    // Run simulation for all 3 demo subreddits in parallel
    const results = await Promise.all(
      DEMO_SUBREDDITS.map(async (subredditId) => {
        try {
          const result = await simulatePost({
            text: text.trim(),
            subredditId,
          });
          return {
            subredditId,
            ...result,
          };
        } catch (error) {
          console.error(`Error simulating for ${subredditId}:`, error);
          return {
            subredditId,
            error: error instanceof Error ? error.message : "Simulation failed",
          };
        }
      })
    );
    
    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    console.error("Batch simulation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
