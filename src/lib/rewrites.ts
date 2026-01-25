import { Subreddit } from "@/data/subreddits";
import { ScoringResult } from "./scoring";
import { PersonaWithPolicy } from "./personas";

export interface Rewrite {
  label: string;
  text: string;
  rationale: string;
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
  
  if (hasOpenAI) {
    return await generateRewritesWithOpenAI(text, subredditId, persona, scoringResult);
  } else {
    return generateRewritesHeuristic(text, persona, scoringResult);
  }
}

async function generateRewritesWithOpenAI(
  originalText: string,
  subredditId: string,
  persona: PersonaWithPolicy,
  scoringResult: ScoringResult
): Promise<Rewrite[]> {
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Build persona context
    const normsList = persona.norms.map((n, i) => `${i + 1}. ${n}`).join("\n");
    const failureTriggersList = persona.failureTriggers.map((f, i) => `${i + 1}. ${f}`).join("\n");
    const examplePhrases = (persona.examplePhrases || []).slice(0, 8).join(", ");
    
    // Include weights/thresholds if available
    let policyContext = "";
    if (persona.weights || persona.thresholds) {
      policyContext = "\n\nPolicy Parameters:\n";
      if (persona.weights) {
        policyContext += `Weights: ${JSON.stringify(persona.weights)}\n`;
      }
      if (persona.thresholds) {
        policyContext += `Thresholds: ${JSON.stringify(persona.thresholds)}\n`;
      }
    }

    const prompt = `You are helping rewrite a Reddit post for ${persona.name} (r/${subredditId}).

Original draft:
${originalText}

Subreddit Context:
- Tone: ${persona.tone}
- Community Norms:
${normsList}
- Failure Triggers (avoid these):
${failureTriggersList}
- Example Phrases Used: ${examplePhrases || "N/A"}${policyContext}

Issues Detected in Original:
${scoringResult.reasons.length > 0 ? scoringResult.reasons.map((r, i) => `${i + 1}. ${r}`).join("\n") : "None detected"}

Generate exactly 3 rewrite variants that are clearly tailored to r/${subredditId}. Each rewrite should feel distinct and appropriate for this specific community.

Requirements:
1. "Conservative" - Remove all promotional language, CTAs, and links. Add context and a clear, respectful takeaway. Make it safe and non-promotional.
2. "Norm-Optimized" - Follow the community's preferred structure and norms. Use example phrases naturally. Match the tone (${persona.tone}). Include specific details, numbers, or concrete examples when possible.
3. "Slightly Edgy" - Add a thought-provoking hook or contrarian angle, but stay within community norms. Should be engaging but still respectful and aligned with ${persona.name} standards.

Important:
- Each rewrite MUST be noticeably different and tailored to r/${subredditId}
- Avoid generic rewrites that could work for any subreddit
- Do NOT include direct self-promotion, links, or CTAs
- Keep the core message but adapt the style, structure, and tone
- Each rewrite should be complete and ready to post

Return ONLY valid JSON (no markdown, no code blocks):
{
  "rewrites": [
    {
      "label": "Conservative",
      "text": "...",
      "rationale": "Brief explanation of why this rewrite works for r/${subredditId}"
    },
    {
      "label": "Norm-Optimized",
      "text": "...",
      "rationale": "Brief explanation of how this matches r/${subredditId} norms"
    },
    {
      "label": "Slightly Edgy",
      "text": "...",
      "rationale": "Brief explanation of the edgy angle and why it still fits r/${subredditId}"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "";
    
    try {
      const parsed = JSON.parse(content);
      if (parsed.rewrites && Array.isArray(parsed.rewrites)) {
        // Validate structure
        const rewrites = parsed.rewrites
          .filter((r: any) => r.label && r.text && r.rationale)
          .slice(0, 3)
          .map((r: any) => ({
            label: r.label,
            text: r.text.trim(),
            rationale: r.rationale.trim(),
          }));
        
        if (rewrites.length === 3) {
          return rewrites;
        }
      }
    } catch (parseError) {
      console.error("Failed to parse OpenAI JSON response:", parseError);
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.rewrites && Array.isArray(parsed.rewrites)) {
            const rewrites = parsed.rewrites
              .filter((r: any) => r.label && r.text && r.rationale)
              .slice(0, 3)
              .map((r: any) => ({
                label: r.label,
                text: r.text.trim(),
                rationale: r.rationale.trim(),
              }));
            if (rewrites.length === 3) {
              return rewrites;
            }
          }
        } catch (e) {
          console.error("Failed to parse extracted JSON:", e);
        }
      }
    }
  } catch (error) {
    console.error("OpenAI error:", error);
  }
  
  // Fallback to heuristic if OpenAI fails
  return generateRewritesHeuristic(originalText, persona, scoringResult);
}

function generateRewritesHeuristic(
  originalText: string,
  persona: PersonaWithPolicy,
  scoringResult: ScoringResult
): Rewrite[] {
  const text = originalText.trim();
  const words = text.split(/\s+/);
  
  // Conservative: Remove CTAs, add context
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
  
  // Ensure it ends with a takeaway or question
  if (!/[?.!]$/.test(result)) {
    result += " What do you think?";
  }
  
  return result;
}

function generateNormOptimized(text: string, persona: PersonaWithPolicy): string {
  const lowerText = text.toLowerCase();
  
  // Check if already structured
  if (lowerText.includes("context:") || lowerText.includes("what i tried")) {
    return text; // Already structured
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
    return text;
  }
  
  return `${opener} ${text}`;
}
