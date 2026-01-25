import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function tokenize(s: string) {
  return s
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const STOP = new Set([
  "the","a","an","and","or","to","of","in","on","for","with","is","are","was","were",
  "i","we","you","my","our","your","it","this","that","be","as","at","from"
]);

const PROMO = ["buy","sign","signup","subscribe","dm","link","discount","limited","launch","join","free","sale","promo"];

function topPhrases(texts: string[], n = 12) {
  const counts = new Map<string, number>();
  for (const t of texts) {
    const toks = tokenize(t).filter((w) => !STOP.has(w) && w.length > 2);
    for (let i = 0; i < toks.length - 1; i++) {
      const bigram = `${toks[i]} ${toks[i + 1]}`;
      counts.set(bigram, (counts.get(bigram) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([p]) => p);
}

function ratePromo(texts: string[]) {
  let hits = 0;
  for (const t of texts) {
    const lower = t.toLowerCase();
    if (PROMO.some((w) => lower.includes(w))) hits++;
  }
  return texts.length ? hits / texts.length : 0;
}

function rateSpecific(texts: string[]) {
  let hits = 0;
  for (const t of texts) {
    const hasNum = /\d/.test(t);
    const hasTools = /(aws|docker|kubernetes|next\.?js|supabase|stripe|openai|react|typescript)/i.test(t);
    if (hasNum || hasTools) hits++;
  }
  return texts.length ? hits / texts.length : 0;
}

function rateFirstPerson(texts: string[]) {
  let hits = 0;
  for (const t of texts) {
    if (/\b(i|we|my|our)\b/i.test(t)) hits++;
  }
  return texts.length ? hits / texts.length : 0;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { subredditId } = await req.json().catch(() => ({ subredditId: "" }));
  const id = String(subredditId || "").trim();
  if (!id) return NextResponse.json({ error: "subredditId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("subreddit_examples")
    .select("text,label")
    .eq("subreddit_id", id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  type ExampleRow = { text: string; label: string };
  const texts = ((data as ExampleRow[]) ?? []).map((r) => r.text);

  if (texts.length < 10) {
    return NextResponse.json({ error: "need at least 10 examples to rebuild persona" }, { status: 400 });
  }

  const phrases = topPhrases(texts, 12);
  const promoRate = ratePromo(texts);
  const specificityRate = rateSpecific(texts);
  const firstPersonRate = rateFirstPerson(texts);

  // Simple deterministic persona update
  const tone =
    id === "MachineLearning" ? "technical, evidence-driven" :
    id === "technology" ? "skeptical, discussion-oriented" :
    "direct, experience-driven";

  const norms = [
    specificityRate > 0.35 ? "Include concrete details (numbers, tools, what you tried)." : "Add specifics instead of general statements.",
    firstPersonRate > 0.35 ? "Use first-person experience and clear context." : "Provide context: who you are and what problem you faced.",
    promoRate > 0.2 ? "Avoid promotional language; focus on lessons or questions." : "Keep the tone informational, not salesy.",
    "End with a clear question or takeaway for the community."
  ];

  const failure_triggers = [
    promoRate > 0.15 ? "Obvious self-promo or calls-to-action." : "Overly hypey claims without evidence.",
    "Vague buzzwords without concrete substance.",
    "No context or unclear purpose for posting."
  ];

  // “Training” = recalibrated policy params
  const weights = {
    salesyPenaltyWeight: 0.9 + promoRate,         // stricter if community has promo
    vaguenessPenaltyWeight: 0.9,
    normBonusWeight: 1.1 + specificityRate * 0.5, // reward specificity more
    lengthPenaltyWeight: 0.6
  };

  const thresholds = {
    removed: 0.25 - promoRate * 0.05,
    ignored: 0.45,
    discussed: 0.7
  };

  const { error: upsertErr } = await supabaseAdmin
    .from("subreddit_personas")
    .upsert({
      subreddit_id: id,
      name: `r/${id === "MachineLearning" ? "MachineLearning" : id}`,
      tone,
      norms,
      failure_triggers,
      example_phrases: phrases,
      weights,
      thresholds,
      updated_at: new Date().toISOString()
    } as any, { onConflict: "subreddit_id" });

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    signals: { promoRate, specificityRate, firstPersonRate, topPhrases: phrases.slice(0, 8) },
  });
}
