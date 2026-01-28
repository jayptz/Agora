import { Subreddit } from "@/data/subreddits";
import { ScoringResult, calculateScore, salesyPenalty, vaguenessPenalty } from "./scoring";
import { PersonaWithPolicy } from "./personas";

export interface Rewrite {
  label: string;
  text: string;
  rationale: string;
  estimatedScore?: number;
  scoreImprovement?: number;
}

export async function generateRewrites({
  text,
  subredditId,
  persona,
  scoringResult,
}: {
  text: string;
  subredditId: string;
  persona: PersonaWithPolicy;
  scoringResult: ScoringResult;
}): Promise<Rewrite[]> {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const originalScore = scoringResult.score;
  
  let rewrites: Rewrite[];
  
  if (hasOpenAI) {
    rewrites = await generateRewritesWithOpenAI(text, subredditId, persona, scoringResult, originalScore);
  } else {
    rewrites = generateRewritesHeuristic(text, persona, scoringResult, originalScore);
  }
  
  // Calculate estimated scores and improvements
  for (const rewrite of rewrites) {
    const rewriteScore = calculateScore(rewrite.text, persona, persona.weights, persona.thresholds);
    rewrite.estimatedScore = rewriteScore.score;
    rewrite.scoreImprovement = rewriteScore.score - originalScore;
  }
  
  return rewrites;
}

async function generateRewritesWithOpenAI(
  originalText: string,
  subredditId: string,
  persona: PersonaWithPolicy,
  scoringResult: ScoringResult,
  originalScore: number
): Promise<Rewrite[]> {
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build persona context
    const normsList = persona.norms.map((n) => `• ${n}`).join("\n");
    const failureTriggersList = persona.failureTriggers.map((f) => `• ${f}`).join("\n");
    const examplePhrases = (persona.examplePhrases || []).slice(0, 8).join(", ");
    
    // Detect specific issues from scoring
    const hasPromo = salesyPenalty(originalText) > 0.1;
    const hasVague = vaguenessPenalty(originalText) > 0.15;
    const hasNumbers = /\d+/.test(originalText);
    const hasSpecificTools = /(api|sdk|framework|library|tool|service|platform|aws|docker|kubernetes|next\.?js|supabase|stripe|openai|react|typescript)/i.test(originalText);
    const endsWithQuestion = originalText.trim().endsWith("?");
    const hasQuestionWords = /(anyone|thoughts|feedback|what would you|what do you|has anyone|should i)/i.test(originalText);
    
    const issues = [];
    if (hasPromo) issues.push("Remove promotional language and CTAs");
    if (hasVague) issues.push("Add concrete details (numbers, specific tools, examples)");
    if (!hasNumbers && !hasSpecificTools) issues.push("Include at least one specific detail (number, tool, or technology)");
    if (!endsWithQuestion || !hasQuestionWords) issues.push("End with an engaging question that invites discussion");
    
    // System prompt
    const systemPrompt = "You are an expert Reddit community writer. You strictly follow subreddit norms. Each subreddit has unique expectations, tone, and style. Your rewrites MUST be distinctly tailored to the specific subreddit and should NOT be generic or reusable across communities. Optimize for community acceptance, not promotion.";

    // User prompt with all persona details
    const userPrompt = `Rewrite this draft for r/${subredditId}:

ORIGINAL DRAFT (Score: ${originalScore.toFixed(2)}):
${originalText}

SUBREDDIT: r/${subredditId}
TONE: ${persona.tone}

COMMUNITY NORMS (follow these):
${normsList}

FAILURE TRIGGERS (avoid these):
${failureTriggersList}

EXAMPLE PHRASES (use naturally when appropriate):
${examplePhrases || "N/A"}

ISSUES TO FIX:
${issues.length > 0 ? issues.map(i => `• ${i}`).join("\n") : "• Improve alignment with community norms"}

Generate EXACTLY 3 rewrites that are CLEARLY DIFFERENT and SPECIFICALLY TAILORED to r/${subredditId}:

1. "Conservative" - Remove ALL promotional language, CTAs, links. Add context and a clear, respectful takeaway. End with a question. Include at least one concrete detail (number or specific tool).

2. "Norm-Optimized" - Follow r/${subredditId}'s preferred structure. Use example phrases naturally. Match the tone: ${persona.tone}. Include specific details, numbers, or concrete examples. End with an engaging question. ${persona.id === "startups" ? "Use structure: Context → What I tried → Result → Question" : persona.id === "technology" ? "Use neutral, analytical framing" : "Show process and ask for feedback"}.

3. "Slightly Edgy" - Add a thought-provoking hook or contrarian angle, but stay within r/${subredditId} norms. Engaging but respectful. Include concrete details. End with a question.

CRITICAL REQUIREMENTS:
- Each rewrite MUST be noticeably different from the others
- Each rewrite MUST be tailored specifically to r/${subredditId} (NOT generic)
- Remove ALL promotional language and CTAs
- Add at least one concrete detail (number, tool, or specific example)
- End each rewrite with an engaging question
- Use community example phrases naturally
- Optimize for acceptance, not promotion

Output STRICT JSON only (no markdown, no commentary):
{
  "rewrites": [
    {
      "label": "Conservative",
      "text": "..."
    },
    {
      "label": "Norm-Optimized",
      "text": "..."
    },
    {
      "label": "Slightly Edgy",
      "text": "..."
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "";
    
    let rewrites: Rewrite[] = [];
    
    try {
      const parsed = JSON.parse(content);
      if (parsed.rewrites && Array.isArray(parsed.rewrites)) {
        rewrites = parsed.rewrites
          .filter((r: any) => r.label && r.text)
          .slice(0, 3)
          .map((r: any) => ({
            label: r.label,
            text: r.text.trim(),
            rationale: r.rationale || `Optimized for r/${subredditId} community acceptance`,
          }));
      }
    } catch (parseError) {
      console.error("Failed to parse OpenAI JSON response:", parseError);
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.rewrites && Array.isArray(parsed.rewrites)) {
            rewrites = parsed.rewrites
              .filter((r: any) => r.label && r.text)
              .slice(0, 3)
              .map((r: any) => ({
                label: r.label,
                text: r.text.trim(),
                rationale: r.rationale || `Optimized for r/${subredditId} community acceptance`,
              }));
          }
        } catch (e) {
          console.error("Failed to parse extracted JSON:", e);
        }
      }
    }
    
    // Repair pass: check scores and improve if needed
    if (rewrites.length === 3) {
      for (let i = 0; i < rewrites.length; i++) {
        const rewrite = rewrites[i];
        const rewriteScore = calculateScore(rewrite.text, persona, persona.weights, persona.thresholds);
        const improvement = rewriteScore.score - originalScore;
        
        // If improvement is less than 0.10, do a repair pass
        if (improvement < 0.10) {
          const repaired = await repairRewrite(
            openai,
            originalText,
            rewrite.text,
            rewrite.label,
            subredditId,
            persona,
            scoringResult,
            originalScore,
            rewriteScore
          );
          
          if (repaired) {
            rewrites[i] = repaired;
          }
        }
      }
    }
    
    // If we still don't have 3 rewrites, fall back to heuristic
    if (rewrites.length < 3) {
      return generateRewritesHeuristic(originalText, persona, scoringResult, originalScore);
    }
    
    return rewrites;
  } catch (error) {
    console.error("OpenAI error:", error);
  }
  
  // Fallback to heuristic if OpenAI fails
  return generateRewritesHeuristic(originalText, persona, scoringResult, originalScore);
}

async function repairRewrite(
  openai: any,
  originalText: string,
  currentRewrite: string,
  label: string,
  subredditId: string,
  persona: PersonaWithPolicy,
  scoringResult: ScoringResult,
  originalScore: number,
  currentScore: ScoringResult
): Promise<Rewrite | null> {
  try {
    // Identify specific issues
    const hasPromo = salesyPenalty(currentRewrite) > 0.1;
    const hasVague = vaguenessPenalty(currentRewrite) > 0.15;
    const hasNumbers = /\d+/.test(currentRewrite);
    const hasSpecificTools = /(api|sdk|framework|library|tool|service|platform|aws|docker|kubernetes|next\.?js|supabase|stripe|openai|react|typescript)/i.test(currentRewrite);
    const endsWithQuestion = currentRewrite.trim().endsWith("?");
    
    const fixes = [];
    if (hasPromo) fixes.push("Remove any remaining promotional words or CTAs");
    if (hasVague) fixes.push("Replace vague buzzwords with concrete details");
    if (!hasNumbers && !hasSpecificTools) fixes.push("Add at least one specific number or tool name");
    if (!endsWithQuestion) fixes.push("End with a question mark and engaging question");
    
    if (fixes.length === 0) {
      return null; // No fixes needed
    }
    
    const repairPrompt = `Fix this rewrite to improve its score. Current score: ${currentScore.score.toFixed(2)}, target: ${(originalScore + 0.15).toFixed(2)}.

CURRENT REWRITE:
${currentRewrite}

FIXES NEEDED:
${fixes.map(f => `• ${f}`).join("\n")}

SUBREDDIT: r/${subredditId}
TONE: ${persona.tone}

Return ONLY the improved rewrite text (no JSON, no explanation, just the text):`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a Reddit post editor. Fix the rewrite to improve community acceptance." },
        { role: "user", content: repairPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const repairedText = response.choices[0]?.message?.content?.trim() || "";
    
    if (repairedText && repairedText.length > 20) {
      return {
        label,
        text: repairedText,
        rationale: `Repaired to improve score by removing issues and adding required elements`,
      };
    }
  } catch (error) {
    console.error("Repair rewrite error:", error);
  }
  
  return null;
}

function generateRewritesHeuristic(
  originalText: string,
  persona: PersonaWithPolicy,
  scoringResult: ScoringResult,
  originalScore: number
): Rewrite[] {
  const text = originalText.trim();
  
  // Conservative: Remove CTAs, add context, ensure question
  const conservative = generateConservative(text, persona);
  
  // Norm-Optimized: Structure with Context → What I tried → Result → Question
  const normOptimized = generateNormOptimized(text, persona);
  
  // Slightly Edgy: Add contrarian opener
  const slightlyEdgy = generateSlightlyEdgy(text, persona);
  
  return [
    {
      label: "Conservative",
      text: conservative,
      rationale: "Removed promotional language and CTAs, added context and clear takeaway to align with community standards"
    },
    {
      label: "Norm-Optimized",
      text: normOptimized,
      rationale: `Restructured to follow ${persona.name} preferred format: Context → What I tried → Result → Question, with specific details`
    },
    {
      label: "Slightly Edgy",
      text: slightlyEdgy,
      rationale: "Added a thought-provoking opener while maintaining respect for community norms and tone"
    }
  ];
}

function generateConservative(text: string, persona: PersonaWithPolicy): string {
  let result = text;
  
  // Remove common CTAs
  const ctaPatterns = [
    /\b(dm me|message me|contact me|reach out)\b/gi,
    /\b(sign up|subscribe|join now|click here|check out)\b/gi,
    /\b(buy|purchase|order now|act now)\b/gi,
    /\b(limited|exclusive|special offer)\b/gi,
  ];
  
  for (const pattern of ctaPatterns) {
    result = result.replace(pattern, "");
  }
  
  // Clean up extra spaces
  result = result.replace(/\s+/g, " ").trim();
  
  // Add context if too short
  if (result.length < 60 && persona.id === "startups") {
    result = `I wanted to share a lesson I learned: ${result}`;
  }
  
  // Ensure it ends with a question
  if (!result.trim().endsWith("?")) {
    if (result.length < 100) {
      result += " What do you think?";
    } else {
      result += " Has anyone else tried this?";
    }
  }
  
  return result;
}

function generateNormOptimized(text: string, persona: PersonaWithPolicy): string {
  const lowerText = text.toLowerCase();
  
  // Check if already structured
  if (lowerText.includes("context:") || lowerText.includes("what i tried")) {
    // Just ensure it has a question
    if (!text.trim().endsWith("?")) {
      return text + " What's your experience with this?";
    }
    return text;
  }
  
  // Try to extract key parts
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length >= 2) {
    // Structure it
    let structured = "";
    
    // Context
    structured += `Context: ${sentences[0].trim()}\n\n`;
    
    // What I tried
    if (sentences.length >= 2) {
      structured += `What I tried: ${sentences[1].trim()}\n\n`;
    }
    
    // Result
    if (sentences.length >= 3) {
      structured += `Result: ${sentences.slice(2).join(". ").trim()}\n\n`;
    } else {
      structured += `Result: [Add specific outcome here]\n\n`;
    }
    
    // Question
    structured += `Question: What's your experience with this?`;
    
    return structured;
  }
  
  // Fallback: wrap existing text
  return `Context: ${text}\n\nWhat I tried: [Add specifics here]\n\nResult: [Add numbers/outcomes here]\n\nQuestion: What do you think?`;
}

function generateSlightlyEdgy(text: string, persona: PersonaWithPolicy): string {
  const openers: Record<string, string[]> = {
    startups: [
      "Unpopular opinion:",
      "Hot take:",
      "Controversial but:",
    ],
    MachineLearning: [
      "Contrary to popular belief:",
      "Here's a contrarian view:",
    ],
    Entrepreneur: [
      "Most people get this wrong:",
      "Unpopular truth:",
    ],
    SideProject: [
      "Hot take:",
      "Controversial opinion:",
    ],
    cscareerquestions: [
      "Unpopular opinion:",
      "Hot take:",
    ],
    technology: [
      "Contrary to the hype:",
      "Unpopular view:",
    ],
  };
  
  const openerList = openers[persona.id] || ["Hot take:"];
  const opener = openerList[Math.floor(Math.random() * openerList.length)];
  
  // Don't add if already starts with something similar
  const lowerText = text.toLowerCase();
  if (lowerText.startsWith("unpopular") || lowerText.startsWith("hot take") || lowerText.startsWith("contrary")) {
    // Just ensure question
    if (!text.trim().endsWith("?")) {
      return text + " Thoughts?";
    }
    return text;
  }
  
  let result = `${opener} ${text}`;
  
  // Ensure question
  if (!result.trim().endsWith("?")) {
    result += " What do you think?";
  }
  
  return result;
}
