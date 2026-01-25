export interface Subreddit {
  id: string;
  name: string;
  tone: string;
  norms: string[];
  failureTriggers: string[];
  examplePhrases: string[];
}

export const subreddits: Subreddit[] = [
  {
    id: "startups",
    name: "r/startups",
    tone: "direct, practical, founder voice",
    norms: [
      "practical lessons > theory",
      "avoid obvious self-promo",
      "include specifics (numbers, mistakes, what you tried)",
      "clear ask or takeaway"
    ],
    failureTriggers: [
      "generic advice",
      "marketing language",
      "vague claims with no evidence"
    ],
    examplePhrases: ["founder lesson", "traction", "MVP", "churn", "what I learned"]
  },
  {
    id: "MachineLearning",
    name: "r/MachineLearning",
    tone: "technical, research-focused, evidence-based",
    norms: [
      "cite papers or provide technical details",
      "avoid hype without substance",
      "discuss methodology and results",
      "distinguish between research and applications"
    ],
    failureTriggers: [
      "vague claims about AI",
      "self-promotion without technical content",
      "misleading titles",
      "low-effort questions"
    ],
    examplePhrases: ["paper", "model", "accuracy", "dataset", "baseline", "SOTA", "architecture"]
  },
  {
    id: "Entrepreneur",
    name: "r/Entrepreneur",
    tone: "business-focused, growth-oriented, actionable",
    norms: [
      "share real experiences and outcomes",
      "provide actionable insights",
      "discuss challenges honestly",
      "avoid pure motivation without substance"
    ],
    failureTriggers: [
      "get-rich-quick schemes",
      "vague motivational posts",
      "excessive self-promotion",
      "unsubstantiated claims"
    ],
    examplePhrases: ["revenue", "customers", "growth", "strategy", "market", "pivot", "validation"]
  },
  {
    id: "SideProject",
    name: "r/SideProject",
    tone: "encouraging, constructive, maker-focused",
    norms: [
      "show what you built",
      "share your process",
      "ask for feedback",
      "be open about challenges"
    ],
    failureTriggers: [
      "pure marketing without showing work",
      "asking for users without showing product",
      "vague project descriptions"
    ],
    examplePhrases: ["built", "launched", "demo", "feedback", "tech stack", "open source"]
  },
  {
    id: "cscareerquestions",
    name: "r/cscareerquestions",
    tone: "practical, career-focused, supportive",
    norms: [
      "be specific about situation",
      "include relevant details (location, experience level)",
      "ask clear questions",
      "search before posting"
    ],
    failureTriggers: [
      "vague questions without context",
      "easily searchable questions",
      "low-effort posts",
      "bragging without substance"
    ],
    examplePhrases: ["YOE", "TC", "offer", "interview", "resume", "career path", "FAANG"]
  },
  {
    id: "technology",
    name: "r/technology",
    tone: "news-focused, informative, discussion-oriented",
    norms: [
      "share news with context",
      "provide analysis or discussion points",
      "avoid clickbait",
      "cite sources"
    ],
    failureTriggers: [
      "clickbait titles",
      "low-quality sources",
      "pure opinion without facts",
      "duplicate submissions"
    ],
    examplePhrases: ["announcement", "report", "analysis", "impact", "trend", "breakthrough"]
  }
];

export function getSubredditById(id: string): Subreddit | undefined {
  return subreddits.find(s => s.id === id);
}
