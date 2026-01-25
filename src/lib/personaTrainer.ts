/**
 * Persona Trainer: Derives signals from examples and trains persona parameters
 * Deterministic approach (no LLM required, but optional beautification available)
 */

export interface TrainingSignals {
  topPhrases: string[];
  promoRate: number;
  avgLen: number;
  specificityRate: number;
  firstPersonRate: number;
}

export interface PersonaWeights {
  salesyPenaltyWeight?: number;
  vaguenessPenaltyWeight?: number;
  normBonusWeight?: number;
  lengthPenaltyWeight?: number;
}

export interface PersonaThresholds {
  removed?: number;
  ignored?: number;
  discussed?: number;
  upvoted?: number;
}

export interface TrainedPersona {
  example_phrases: string[];
  norms: string[];
  failure_triggers: string[];
  weights: PersonaWeights;
  thresholds: PersonaThresholds;
}

const SALESY_WORDS = [
  "buy", "sign up", "limited", "dm me", "join now", "click here",
  "check out", "visit", "subscribe", "purchase", "order now",
  "act now", "don't miss", "exclusive", "special offer"
];

const BUZZWORDS = [
  "revolutionary", "game-changer", "disruptive", "innovative",
  "cutting-edge", "next-level", "mind-blowing", "amazing",
  "incredible", "unbelievable", "groundbreaking"
];

/**
 * Extract common phrases from examples (simple n-gram approach)
 */
function extractTopPhrases(examples: string[], minCount: number = 2): string[] {
  const phraseCounts = new Map<string, number>();
  
  for (const example of examples) {
    const words = example.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3); // Only words longer than 3 chars
    
    // Extract 2-grams and 3-grams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      phraseCounts.set(bigram, (phraseCounts.get(bigram) || 0) + 1);
    }
    
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      phraseCounts.set(trigram, (phraseCounts.get(trigram) || 0) + 1);
    }
  }
  
  // Filter by minCount and sort by frequency
  const topPhrases = Array.from(phraseCounts.entries())
    .filter(([_, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase, _]) => phrase);
  
  return topPhrases;
}

/**
 * Derive signals from a collection of examples
 */
export function deriveSignals(examples: string[]): TrainingSignals {
  if (examples.length === 0) {
    return {
      topPhrases: [],
      promoRate: 0,
      avgLen: 0,
      specificityRate: 0,
      firstPersonRate: 0,
    };
  }
  
  const topPhrases = extractTopPhrases(examples);
  
  let promoCount = 0;
  let totalLen = 0;
  let specificityCount = 0;
  let firstPersonCount = 0;
  
  for (const example of examples) {
    const lowerText = example.toLowerCase();
    
    // Check for promotional language
    const hasPromo = SALESY_WORDS.some(word => lowerText.includes(word));
    if (hasPromo) promoCount++;
    
    // Track length
    totalLen += example.trim().length;
    
    // Check for specificity (numbers or concrete artifacts)
    const hasNumbers = /\d+/.test(example);
    const hasSpecificTools = /(api|sdk|framework|library|tool|service|platform|github|npm|docker|kubernetes|aws|gcp|azure)/i.test(example);
    if (hasNumbers || hasSpecificTools) specificityCount++;
    
    // Check for first person
    if (/^i\s|^we\s|^my\s|^our\s/i.test(example.trim())) {
      firstPersonCount++;
    }
  }
  
  return {
    topPhrases,
    promoRate: promoCount / examples.length,
    avgLen: totalLen / examples.length,
    specificityRate: specificityCount / examples.length,
    firstPersonRate: firstPersonCount / examples.length,
  };
}

/**
 * Generate norms from signals (deterministic templates)
 */
function generateNormsFromSignals(signals: TrainingSignals, subredditId: string): string[] {
  const norms: string[] = [];
  
  // Specificity norm
  if (signals.specificityRate > 0.6) {
    norms.push("include concrete details: numbers, tools, or specific artifacts");
  } else if (signals.specificityRate < 0.3) {
    norms.push("prefer concrete examples over abstract claims");
  }
  
  // Promotional language norm
  if (signals.promoRate < 0.1) {
    norms.push("avoid promotional language and direct sales pitches");
  } else if (signals.promoRate > 0.3) {
    norms.push("community tolerates some promotional content but prefers value-first");
  }
  
  // Length norm
  if (signals.avgLen > 500) {
    norms.push("detailed posts are welcome, but keep them focused");
  } else if (signals.avgLen < 100) {
    norms.push("provide sufficient context and detail");
  } else {
    norms.push("aim for concise but informative posts");
  }
  
  // First person norm
  if (signals.firstPersonRate > 0.5) {
    norms.push("personal experiences and first-person narratives are valued");
  }
  
  // Subreddit-specific defaults
  if (subredditId === "startups") {
    norms.push("share practical lessons and real outcomes");
    norms.push("include specifics: numbers, mistakes, what you tried");
  } else if (subredditId === "MachineLearning") {
    norms.push("cite papers or provide technical details");
    norms.push("distinguish between research and applications");
  } else if (subredditId === "technology") {
    norms.push("share news with context and analysis");
    norms.push("cite sources and avoid clickbait");
  }
  
  // Remove duplicates and limit
  return Array.from(new Set(norms)).slice(0, 6);
}

/**
 * Generate failure triggers from signals
 */
function generateFailureTriggersFromSignals(signals: TrainingSignals): string[] {
  const triggers: string[] = [];
  
  if (signals.promoRate < 0.1) {
    triggers.push("generic marketing language");
    triggers.push("obvious self-promotion");
  }
  
  if (signals.specificityRate < 0.3) {
    triggers.push("vague claims with no evidence");
    triggers.push("buzzwords without substance");
  }
  
  if (signals.avgLen < 80) {
    triggers.push("low-effort posts");
  }
  
  // Default triggers
  triggers.push("clickbait titles");
  triggers.push("misleading information");
  
  return Array.from(new Set(triggers)).slice(0, 5);
}

/**
 * Compute weights from signals
 */
function computeWeights(signals: TrainingSignals): PersonaWeights {
  // Base weights
  const weights: PersonaWeights = {
    salesyPenaltyWeight: 1.0,
    vaguenessPenaltyWeight: 1.0,
    normBonusWeight: 1.0,
    lengthPenaltyWeight: 1.0,
  };
  
  // Adjust based on promo rate
  if (signals.promoRate > 0.3) {
    weights.salesyPenaltyWeight = 0.7; // Less penalty if community tolerates promo
  } else if (signals.promoRate < 0.1) {
    weights.salesyPenaltyWeight = 1.3; // More penalty if community hates promo
  }
  
  // Adjust based on specificity
  if (signals.specificityRate > 0.7) {
    weights.vaguenessPenaltyWeight = 1.3; // Penalize vagueness more
  } else if (signals.specificityRate < 0.3) {
    weights.vaguenessPenaltyWeight = 0.8; // Less penalty if community is vague
  }
  
  // Adjust based on length
  if (signals.avgLen > 600) {
    weights.lengthPenaltyWeight = 0.7; // Long posts are OK
  } else if (signals.avgLen < 100) {
    weights.lengthPenaltyWeight = 1.3; // Short posts are penalized
  }
  
  return weights;
}

/**
 * Compute thresholds from signals
 */
function computeThresholds(signals: TrainingSignals): PersonaThresholds {
  // Base thresholds
  let removed = 0.25;
  let ignored = 0.45;
  let discussed = 0.7;
  
  // Adjust based on promo rate (if high promo rate, be more lenient)
  if (signals.promoRate > 0.3) {
    removed = 0.2;
    ignored = 0.4;
    discussed = 0.65;
  } else if (signals.promoRate < 0.1) {
    removed = 0.3;
    ignored = 0.5;
    discussed = 0.75;
  }
  
  // Adjust based on specificity (if high specificity, reward it more)
  if (signals.specificityRate > 0.7) {
    discussed = 0.65; // Lower bar for "discussed" if community values specificity
  }
  
  return {
    removed,
    ignored,
    discussed,
    upvoted: 1.0, // Always 1.0 (above discussed)
  };
}

/**
 * Train persona from examples
 */
export async function trainPersonaFromExamples(
  subredditId: string,
  examples: string[]
): Promise<{ signals: TrainingSignals; persona: TrainedPersona }> {
  if (examples.length === 0) {
    throw new Error("Cannot train persona with no examples");
  }
  
  // Derive signals
  const signals = deriveSignals(examples);
  
  // Generate persona components
  const norms = generateNormsFromSignals(signals, subredditId);
  const failureTriggers = generateFailureTriggersFromSignals(signals);
  const weights = computeWeights(signals);
  const thresholds = computeThresholds(signals);
  
  // Use top phrases as example phrases (limit to 15)
  const examplePhrases = signals.topPhrases.slice(0, 15);
  
  const persona: TrainedPersona = {
    example_phrases: examplePhrases,
    norms,
    failure_triggers: failureTriggers,
    weights,
    thresholds,
  };
  
  return { signals, persona };
}
