import { Subreddit } from "@/data/subreddits";
import { ScoringResult } from "./scoring";

export interface Rewrite {
  label: string;
  text: string;
  rationale: string;
}

export async function generateRewrites(
  originalText: string,
  persona: Subreddit,
  scoringResult: ScoringResult
): Promise<Rewrite[]> {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  
  if (hasOpenAI) {
    return await generateRewritesWithOpenAI(originalText, persona, scoringResult);
  } else {
    return generateRewritesHeuristic(originalText, persona, scoringResult);
  }
}

async function generateRewritesWithOpenAI(
  originalText: string,
  persona: Subreddit,
  scoringResult: ScoringResult
): Promise<Rewrite[]> {
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `You are helping rewrite a Reddit post for ${persona.name}.

Original post:
${originalText}

Subreddit tone: ${persona.tone}
Norms: ${persona.norms.join(", ")}
Issues detected: ${scoringResult.reasons.join("; ")}

Generate 3 rewrite variants as JSON array:
1. "Conservative" - Remove CTAs, add context and clear takeaway, make it more respectful
2. "Norm-Optimized" - Follow the structure: Context → What I tried → Result → Question, add specific details
3. "Slightly Edgy" - Add a contrarian or provocative opener but keep it respectful and aligned with community norms

Return JSON only:
[
  {
    "label": "Conservative",
    "text": "...",
    "rationale": "..."
  },
  {
    "label": "Norm-Optimized",
    "text": "...",
    "rationale": "..."
  },
  {
    "label": "Slightly Edgy",
    "text": "...",
    "rationale": "..."
  }
]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const rewrites = JSON.parse(jsonMatch[0]) as Rewrite[];
      return rewrites;
    }
  } catch (error) {
    console.error("OpenAI error:", error);
  }
  
  // Fallback to heuristic if OpenAI fails
  return generateRewritesHeuristic(originalText, persona, scoringResult);
}

function generateRewritesHeuristic(
  originalText: string,
  persona: Subreddit,
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

function generateConservative(text: string, persona: Subreddit): string {
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

function generateNormOptimized(text: string, persona: Subreddit): string {
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

function generateSlightlyEdgy(text: string, persona: Subreddit): string {
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
