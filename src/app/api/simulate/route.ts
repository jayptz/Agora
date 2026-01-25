import { NextRequest, NextResponse } from "next/server";
import { calculateScore } from "@/lib/scoring";
import { generateRewrites } from "@/lib/rewrites";
import { loadPersona, saveSimulationRun } from "@/lib/personas";

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
    
    // Load persona from Supabase first, fallback to static
    const { persona, source } = await loadPersona(subredditId);
    
    if (!persona) {
      return NextResponse.json(
        { error: `Subreddit ${subredditId} not found` },
        { status: 404 }
      );
    }
    
    // Calculate score and outcome (use trained weights/thresholds if available)
    const scoringResult = calculateScore(
      text.trim(),
      persona,
      persona.weights,
      persona.thresholds
    );
    
    // Generate rewrites
    const rewrites = await generateRewrites(text.trim(), persona, scoringResult);
    
    // Save to Supabase (best-effort, don't fail if this errors)
    saveSimulationRun(
      subredditId,
      text.trim(),
      scoringResult.score,
      scoringResult.outcome,
      scoringResult.confidence,
      scoringResult.reasons,
      rewrites
    ).catch((err) => {
      console.error("Failed to save simulation run (non-fatal):", err);
    });
    
    return NextResponse.json({
      outcome: scoringResult.outcome,
      confidence: scoringResult.confidence,
      score: Math.round(scoringResult.score * 100) / 100,
      reasons: scoringResult.reasons,
      rewrites: rewrites.map(r => ({
        label: r.label,
        text: r.text,
        rationale: r.rationale
      })),
      personaSource: source || "static" // Indicate where persona came from
    });
  } catch (error) {
    console.error("Simulation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
