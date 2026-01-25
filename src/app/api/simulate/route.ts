import { NextRequest, NextResponse } from "next/server";
import { simulatePost } from "@/lib/simulateCore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, subredditId } = body;
    
    // Validation
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required and cannot be empty" },
        { status: 400 }
      );
    }
    
    if (!subredditId || typeof subredditId !== "string") {
      return NextResponse.json(
        { error: "subredditId is required" },
        { status: 400 }
      );
    }
    
    // Use simulateCore for all simulation logic
    const result = await simulatePost({
      text,
      subredditId,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
