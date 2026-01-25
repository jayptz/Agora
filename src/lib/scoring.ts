import { Subreddit } from "@/data/subreddits";

export type Outcome = "Removed" | "Ignored" | "Discussed" | "Upvoted";
export type Confidence = "Low" | "Medium" | "High";

export interface ScoringResult {
  score: number;
  outcome: Outcome;
  confidence: Confidence;
  reasons: string[];
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

export function salesyPenalty(text: string): number {
  const lowerText = text.toLowerCase();
  let penalty = 0;
  
  for (const word of SALESY_WORDS) {
    const matches = (lowerText.match(new RegExp(word, "gi")) || []).length;
    penalty += matches * 0.15;
  }
  
  return Math.min(penalty, 0.5); // Cap at 0.5
}

export function vaguenessPenalty(text: string): number {
  const lowerText = text.toLowerCase();
  let penalty = 0;
  
  // Count buzzwords
  for (const word of BUZZWORDS) {
    const matches = (lowerText.match(new RegExp(word, "gi")) || []).length;
    penalty += matches * 0.1;
  }
  
  // Check for concrete indicators (numbers, specific tools/technologies)
  const hasNumbers = /\d+/.test(text);
  const hasSpecificTools = /(api|sdk|framework|library|tool|service|platform)/i.test(text);
  const concreteIndicators = (hasNumbers ? 1 : 0) + (hasSpecificTools ? 1 : 0);
  
  // If very few concrete indicators and many buzzwords, increase penalty
  if (concreteIndicators === 0 && penalty > 0.2) {
    penalty += 0.2;
  }
  
  return Math.min(penalty, 0.4); // Cap at 0.4
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
  
  return Math.min(bonus, 0.6); // Cap at 0.6
}

export function lengthPenalty(text: string): number {
  const length = text.trim().length;
  let penalty = 0;
  
  if (length < 40) {
    penalty = 0.3; // Too short
  } else if (length > 280) {
    penalty = (length - 280) / 1000; // Gradual penalty for very long
    penalty = Math.min(penalty, 0.3);
  }
  
  return penalty;
}

export function calculateScore(text: string, persona: Subreddit): ScoringResult {
  const salesy = salesyPenalty(text);
  const vague = vaguenessPenalty(text);
  const normBonus = normMatchBonus(text, persona);
  const length = lengthPenalty(text);
  
  const baseScore = normBonus;
  const totalPenalty = salesy + vague + length;
  const score = Math.max(0, Math.min(1, baseScore - totalPenalty + 0.3)); // Add base 0.3 for neutral
  
  // Generate reasons
  const reasons: string[] = [];
  
  if (salesy > 0.2) {
    reasons.push(`Sounds salesy for ${persona.name}: too many CTAs or promotional language`);
  }
  
  if (vague > 0.25) {
    reasons.push(`Lacks concrete details: too many buzzwords without specific evidence or numbers`);
  }
  
  if (length > 0.2) {
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
  
  // Determine outcome
  let outcome: Outcome;
  if (score < 0.25) {
    outcome = "Removed";
  } else if (score < 0.45) {
    outcome = "Ignored";
  } else if (score < 0.7) {
    outcome = "Discussed";
  } else {
    outcome = "Upvoted";
  }
  
  // Determine confidence
  let confidence: Confidence;
  const distanceToBoundary = Math.min(
    Math.abs(score - 0.25),
    Math.abs(score - 0.45),
    Math.abs(score - 0.7)
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
    reasons: reasons.slice(0, 6) // Max 6 reasons
  };
}
