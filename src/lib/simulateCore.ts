/**
 * Core simulation logic shared by /api/simulate and /api/simulate-batch
 */

import { calculateScore, ScoringResult } from "@/lib/scoring";
import { generateRewrites } from "@/lib/rewrites";
import { loadPersona, saveSimulationRun, PersonaWithPolicy } from "@/lib/personas";
import { PersonaWeights, PersonaThresholds } from "./personaTrainer";
import { getSupabaseAdmin } from "./supabaseAdmin";

export interface SimResult {
  outcome: string;
  confidence: string;
  score: number;
  reasons: string[];
  rewrites: Array<{ label: string; text: string; rationale: string }>;
  personaSource: "supabase" | "static";
  personaSnapshot: {
    name?: string;
    subredditId?: string;
    signalsFromTraining?: {
      promoRate?: number;
      specificityRate?: number;
      firstPersonRate?: number;
      topPhrases?: string[];
    };
    topPhrases?: string[];
    weights?: Record<string, number>;
    thresholds?: Record<string, number>;
    memory?: {
      examplesCount?: number;
      lastTrainedAt?: string;
    };
  };
  agentRationale?: string;
  memory?: {
    examplesObserved?: number;
    lastTrainedAt?: string;
  };
}

const PROMO_WORDS = [
  "buy", "sign up", "limited", "dm me", "join now", "click here",
  "check out", "visit", "subscribe", "purchase", "order now",
  "act now", "don't miss", "exclusive", "special offer"
];

/**
 * Compute signals from input text (same logic as trainer)
 */
function computeSignalsFromText(text: string): {
  promoRate: number;
  specificityRate: number;
  firstPersonRate: number;
} {
  const lowerText = text.toLowerCase();
  
  // Promo rate
  const hasPromo = PROMO_WORDS.some(word => lowerText.includes(word));
  const promoRate = hasPromo ? 1 : 0;
  
  // Specificity rate
  const hasNumbers = /\d+/.test(text);
  const hasSpecificTools = /(api|sdk|framework|library|tool|service|platform|aws|docker|kubernetes|next\.?js|supabase|stripe|openai|react|typescript)/i.test(text);
  const specificityRate = (hasNumbers || hasSpecificTools) ? 1 : 0;
  
  // First person rate
  const firstPersonRate = /\b(i|we|my|our)\b/i.test(text) ? 1 : 0;
  
  return { promoRate, specificityRate, firstPersonRate };
}

/**
 * Core simulation function
 */
export async function simulatePost({
  text,
  subredditId,
  trainingVersion,
}: {
  text: string;
  subredditId: string;
  trainingVersion?: "before" | "after";
}): Promise<SimResult> {
  // Load persona from Supabase first, fallback to static
  const { persona, source } = await loadPersona(subredditId);
  
  if (!persona) {
    throw new Error(`Subreddit ${subredditId} not found`);
  }
  
  // Calculate score and outcome (use trained weights/thresholds if available)
  const scoringResult: ScoringResult = calculateScore(
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
    rewrites,
    trainingVersion
  ).catch((err) => {
    console.error("Failed to save simulation run (non-fatal):", err);
  });
  
  // Compute signals from input text
  const signals = computeSignalsFromText(text.trim());
  
  // Get memory info if from Supabase
  let memory: { examplesObserved?: number; lastTrainedAt?: string } | undefined;
  let examplesCount: number | undefined;
  
  if (source === "supabase" && persona.updatedAt) {
    memory = {
      lastTrainedAt: persona.updatedAt,
    };
    
    // Try to get examples count (best-effort)
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { count } = await supabase
          .from("subreddit_examples")
          .select("*", { count: "exact", head: true })
          .eq("subreddit_id", subredditId);
        examplesCount = count || undefined;
        if (examplesCount !== undefined) {
          memory.examplesObserved = examplesCount;
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Generate agent rationale (deterministic, no LLM)
  const agentRationale = generateAgentRationale(
    signals,
    scoringResult,
    persona.weights,
    persona.thresholds,
    persona.lastSignals
  );
  
  // Build persona snapshot
  const personaSnapshot: SimResult["personaSnapshot"] = {
    name: persona.name,
    subredditId: persona.id,
    signalsFromTraining: persona.lastSignals,
    topPhrases: persona.examplePhrases.slice(0, 8),
    weights: persona.weights ? (() => {
      const w: Record<string, number> = {};
      if (persona.weights!.salesyPenaltyWeight !== undefined) w.salesyPenaltyWeight = persona.weights!.salesyPenaltyWeight;
      if (persona.weights!.vaguenessPenaltyWeight !== undefined) w.vaguenessPenaltyWeight = persona.weights!.vaguenessPenaltyWeight;
      if (persona.weights!.normBonusWeight !== undefined) w.normBonusWeight = persona.weights!.normBonusWeight;
      if (persona.weights!.lengthPenaltyWeight !== undefined) w.lengthPenaltyWeight = persona.weights!.lengthPenaltyWeight;
      return Object.keys(w).length > 0 ? w : undefined;
    })() : undefined,
    thresholds: persona.thresholds ? (() => {
      const t: Record<string, number> = {};
      if (persona.thresholds!.removed !== undefined) t.removed = persona.thresholds!.removed;
      if (persona.thresholds!.ignored !== undefined) t.ignored = persona.thresholds!.ignored;
      if (persona.thresholds!.discussed !== undefined) t.discussed = persona.thresholds!.discussed;
      if (persona.thresholds!.upvoted !== undefined) t.upvoted = persona.thresholds!.upvoted;
      return Object.keys(t).length > 0 ? t : undefined;
    })() : undefined,
    memory: examplesCount !== undefined || persona.updatedAt ? {
      examplesCount,
      lastTrainedAt: persona.updatedAt,
    } : undefined,
  };
  
  return {
    outcome: scoringResult.outcome,
    confidence: scoringResult.confidence,
    score: Math.round(scoringResult.score * 100) / 100,
    reasons: scoringResult.reasons,
    rewrites: rewrites.map(r => ({
      label: r.label,
      text: r.text,
      rationale: r.rationale,
    })),
    personaSource: source || "static",
    personaSnapshot,
    agentRationale,
    memory,
  };
}

/**
 * Generate agent rationale from signals and policy (deterministic)
 */
function generateAgentRationale(
  draftSignals: { promoRate: number; specificityRate: number; firstPersonRate: number },
  scoringResult: ScoringResult,
  weights?: PersonaWeights,
  thresholds?: PersonaThresholds,
  trainingSignals?: { promoRate?: number; specificityRate?: number; firstPersonRate?: number; topPhrases?: string[] }
): string {
  const parts: string[] = [];
  
  // Check if community is sensitive to promo
  const communityPromoSensitive = trainingSignals?.promoRate !== undefined && trainingSignals.promoRate < 0.2;
  const draftIsPromo = draftSignals.promoRate > 0;
  
  if (communityPromoSensitive && draftIsPromo) {
    parts.push("This community is sensitive to promotional language");
  } else if (draftIsPromo) {
    parts.push("Your draft contains promotional language");
  }
  
  // Check specificity
  const communityValuesSpecificity = trainingSignals?.specificityRate !== undefined && trainingSignals.specificityRate > 0.4;
  const draftIsSpecific = draftSignals.specificityRate > 0;
  
  if (communityValuesSpecificity && !draftIsSpecific) {
    parts.push("and rewards specific context, but your draft lacks concrete details");
  } else if (!draftIsSpecific) {
    parts.push("and lacks concrete details");
  } else if (communityValuesSpecificity && draftIsSpecific) {
    parts.push("and your draft includes specific details, which aligns well");
  }
  
  // Outcome-based conclusion
  if (scoringResult.outcome === "Removed" || scoringResult.outcome === "Ignored") {
    parts.push(`so it's likely to be ${scoringResult.outcome.toLowerCase()}.`);
  } else if (scoringResult.outcome === "Discussed") {
    parts.push("so it should generate discussion.");
  } else {
    parts.push("so it's likely to be well-received.");
  }
  
  return parts.join(" ") || "The agent analyzed your draft against community norms.";
}
