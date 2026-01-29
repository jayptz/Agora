import { Subreddit } from "@/data/subreddits";
import { PersonaWeights, PersonaThresholds } from "./personaTrainer";

export type Outcome = "Removed" | "Ignored" | "Discussed" | "Upvoted";
export type Confidence = "Low" | "Medium" | "High";

export interface ScoringResult {
  score: number;
  outcome: Outcome;
  confidence: Confidence;
  reasons: string[];
  modRisk?: boolean;
}

const SALESY_WORDS = [
  "buy", "sign up", "limited", "dm me", "join now", "click here",
  "check out", "visit", "subscribe", "purchase", "order now",
  "act now", "don't miss", "exclusive", "special offer"
];

// Severe triggers that indicate mod-level violations
const SEVERE_TRIGGERS = [
  "join waitlist", "waitlist", "dm me", "message me", "contact me",
  "buy now", "purchase now", "order now", "use my referral", "referral code",
  "discount code", "promo code", "coupon code", "http://", "https://",
  "www.", ".com", ".io", "sign up here", "click here to"
];

const BUZZWORDS = [
  "revolutionary", "game-changer", "disruptive", "innovative",
  "cutting-edge", "next-level", "mind-blowing", "amazing",
  "incredible", "unbelievable", "groundbreaking"
];

export function salesyPenalty(text: string): number {
  const lowerText = text.toLowerCase();
  let penalty = 0;
  
  for (const word of SALESY_WORDS) {
    const matches = (lowerText.match(new RegExp(word, "gi")) || []).length;
    penalty += matches * 0.12; // Reduced from 0.15 for smoother penalty
  }
  
  return Math.min(penalty, 0.4); // Reduced cap from 0.5
}

export function vaguenessPenalty(text: string): number {
  const lowerText = text.toLowerCase();
  let penalty = 0;
  
  // Count buzzwords
  for (const word of BUZZWORDS) {
    const matches = (lowerText.match(new RegExp(word, "gi")) || []).length;
    penalty += matches * 0.08; // Reduced from 0.1
  }
  
  // Check for concrete indicators (numbers, specific tools/technologies)
  const hasNumbers = /\d+/.test(text);
  const hasSpecificTools = /(api|sdk|framework|library|tool|service|platform|aws|docker|kubernetes|next\.?js|supabase|stripe|openai|react|typescript)/i.test(text);
  const concreteIndicators = (hasNumbers ? 1 : 0) + (hasSpecificTools ? 1 : 0);
  
  // If very few concrete indicators and many buzzwords, increase penalty
  if (concreteIndicators === 0 && penalty > 0.15) {
    penalty += 0.15; // Reduced from 0.2
  }
  
  return Math.min(penalty, 0.35); // Reduced cap from 0.4
}

export function normMatchBonus(text: string, persona: Subreddit): number {
  const lowerText = text.toLowerCase();
  let bonus = 0;
  
  // Check example phrases
  for (const phrase of persona.examplePhrases) {
    if (lowerText.includes(phrase.toLowerCase())) {
      bonus += 0.1;
    }
  }
  
  // Check norms alignment (simple keyword matching)
  const normKeywords = persona.norms.join(" ").toLowerCase();
  const textWords = lowerText.split(/\s+/);
  const normWords = normKeywords.split(/\s+/).filter(w => w.length > 4);
  
  for (const word of textWords) {
    if (normWords.includes(word)) {
      bonus += 0.05;
    }
  }
  
  return Math.min(bonus, 0.6);
}

export function questionBonus(text: string, persona: Subreddit): number {
  const trimmed = text.trim();
  if (!trimmed.endsWith("?")) {
    return 0;
  }
  
  const lowerText = text.toLowerCase();
  const questionIndicators = [
    "anyone", "thoughts", "feedback", "what would you", "what do you",
    "has anyone", "does anyone", "should i", "would you", "how do you",
    "what's your", "what are your", "any advice", "any suggestions"
  ];
  
  let bonus = 0.05; // Base bonus for ending with question mark
  
  for (const indicator of questionIndicators) {
    if (lowerText.includes(indicator)) {
      bonus += 0.03;
    }
  }
  
  // Persona-specific adjustments
  if (persona.id === "startups" || persona.id === "SideProject") {
    // Feedback questions are especially valued
    if (lowerText.includes("feedback") || lowerText.includes("thoughts")) {
      bonus += 0.02;
    }
  }
  
  return Math.min(bonus, 0.12);
}

export function structureBonus(text: string, persona: Subreddit): number {
  const lowerText = text.toLowerCase();
  let bonus = 0;
  
  // Check for structure markers
  const hasContext = /context\s*:/i.test(text);
  const hasWhatITried = /what\s+i\s+tried\s*:/i.test(lowerText);
  const hasResult = /result\s*:/i.test(lowerText);
  const hasQuestion = /question\s*:/i.test(lowerText);
  const hasBullets = /^[\s]*[-*•]\s+/m.test(text);
  
  // Persona-specific structure preferences
  if (persona.id === "startups") {
    if (hasWhatITried && hasResult) {
      bonus += 0.08;
    }
    if (hasContext) {
      bonus += 0.02;
    }
  } else if (persona.id === "technology") {
    if (hasContext && (hasResult || hasQuestion)) {
      bonus += 0.06;
    }
    // Neutral framing is good
    if (!hasWhatITried && !hasBullets && text.length > 100) {
      bonus += 0.02;
    }
  } else if (persona.id === "SideProject" || persona.id === "sideproject") {
    if (hasBullets || hasWhatITried) {
      bonus += 0.05;
    }
    if (hasQuestion) {
      bonus += 0.02;
    }
  } else {
    // Generic structure bonus
    if (hasContext || hasWhatITried || hasResult || hasQuestion) {
      bonus += 0.05;
    }
    if (hasBullets) {
      bonus += 0.03;
    }
  }
  
  return Math.min(bonus, 0.1);
}

export function lengthPenalty(text: string): number {
  const length = text.trim().length;
  let penalty = 0;
  
  if (length < 40) {
    penalty = 0.25; // Reduced from 0.3
  } else if (length > 280) {
    penalty = (length - 280) / 1200; // More gradual penalty
    penalty = Math.min(penalty, 0.25); // Reduced cap
  }
  
  return penalty;
}

export function checkSevereTriggers(text: string): boolean {
  const lowerText = text.toLowerCase();
  for (const trigger of SEVERE_TRIGGERS) {
    if (lowerText.includes(trigger.toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function calculateScore(
  text: string,
  persona: Subreddit,
  weights?: PersonaWeights,
  thresholds?: PersonaThresholds
): ScoringResult {
  const salesy = salesyPenalty(text);
  const vague = vaguenessPenalty(text);
  const normBonus = normMatchBonus(text, persona);
  const question = questionBonus(text, persona);
  const structure = structureBonus(text, persona);
  const length = lengthPenalty(text);
  const modRisk = checkSevereTriggers(text);
  
  // Apply weights if available, otherwise use defaults (1.0)
  const salesyWeight = weights?.salesyPenaltyWeight ?? 1.0;
  const vaguenessWeight = weights?.vaguenessPenaltyWeight ?? 1.0;
  const normWeight = weights?.normBonusWeight ?? 1.0;
  const lengthWeight = weights?.lengthPenaltyWeight ?? 1.0;
  
  // Calculate base score with bonuses
  const baseScore = (normBonus * normWeight) + question + structure;
  const totalPenalty = (salesy * salesyWeight) + (vague * vaguenessWeight) + (length * lengthWeight);
  
  // Start with 0.35 base (increased from 0.3) for more room to improve
  let score = Math.max(0, Math.min(1, baseScore - totalPenalty + 0.35));
  
  // If severe triggers present, apply heavy penalty but don't hard-clamp to 0
  if (modRisk) {
    score = Math.max(0.05, score - 0.4); // Heavy penalty but allow some score
  }
  
  // Generate reasons
  const reasons: string[] = [];
  
  if (modRisk) {
    reasons.push(`Contains severe promotional triggers (links, waitlist, referral codes) - high mod removal risk`);
  }
  
  if (salesy > 0.15) {
    reasons.push(`Sounds salesy for ${persona.name}: too many CTAs or promotional language`);
  }
  
  if (vague > 0.2) {
    reasons.push(`Lacks concrete details: too many buzzwords without specific evidence or numbers`);
  }
  
  if (length > 0.15) {
    if (text.trim().length < 40) {
      reasons.push(`Too short: needs more context or detail for ${persona.name}`);
    } else {
      reasons.push(`Too long: may lose reader attention in ${persona.name}`);
    }
  }
  
  // Check failure triggers
  const lowerText = text.toLowerCase();
  for (const trigger of persona.failureTriggers) {
    if (lowerText.includes(trigger.toLowerCase())) {
      reasons.push(`Violates ${persona.name} norm: "${trigger}"`);
    }
  }
  
  // Positive reasons
  if (question > 0.05) {
    reasons.push(`Ends with an engaging question that invites discussion`);
  }
  
  if (structure > 0.05) {
    reasons.push(`Uses clear structure that matches ${persona.name} preferences`);
  }
  
  if (normBonus > 0.3) {
    reasons.push(`Aligns well with ${persona.name} tone and example phrases`);
  }
  
  if (salesy < 0.1 && vague < 0.15) {
    reasons.push(`Avoids common pitfalls: not overly salesy or vague`);
  }
  
  // Ensure we have at least 3 reasons
  if (reasons.length < 3) {
    if (score > 0.6) {
      reasons.push(`Strong alignment with community expectations`);
    } else if (score < 0.4) {
      reasons.push(`Needs improvement to match ${persona.name} standards`);
    } else {
      reasons.push(`Mixed signals: some good elements but room for improvement`);
    }
  }
  
  // Determine outcome using thresholds if available, otherwise use defaults
  const removedThreshold = thresholds?.removed ?? 0.25;
  const ignoredThreshold = thresholds?.ignored ?? 0.45;
  const discussedThreshold = thresholds?.discussed ?? 0.7;
  
  let outcome: Outcome;
  // If modRisk and score is very low, force Removed
  if (modRisk && score < 0.15) {
    outcome = "Removed";
  } else if (score < removedThreshold) {
    outcome = "Removed";
  } else if (score < ignoredThreshold) {
    outcome = "Ignored";
  } else if (score < discussedThreshold) {
    outcome = "Discussed";
  } else {
    outcome = "Upvoted";
  }
  
  // Determine confidence
  let confidence: Confidence;
  const distanceToBoundary = Math.min(
    Math.abs(score - removedThreshold),
    Math.abs(score - ignoredThreshold),
    Math.abs(score - discussedThreshold)
  );
  
  if (distanceToBoundary > 0.15 && reasons.length >= 4) {
    confidence = "High";
  } else if (distanceToBoundary > 0.08) {
    confidence = "Medium";
  } else {
    confidence = "Low";
  }
  
  return {
    score,
    outcome,
    confidence,
    reasons: reasons.slice(0, 6), // Max 6 reasons
    modRisk,
  };
}
