import { NextRequest, NextResponse } from "next/server";
import { simulatePost } from "@/lib/simulateCore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Internal function to rebuild persona (reused from rebuild-persona logic)
async function rebuildPersonaInternal(subredditId: string) {
  const { data, error } = await supabaseAdmin
    .from("subreddit_examples")
    .select("text,label")
    .eq("subreddit_id", subredditId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error || !data || data.length < 10) {
    throw new Error("Not enough examples to rebuild persona");
  }

  type ExampleRow = { text: string; label: string };
  const texts = ((data as ExampleRow[]) ?? []).map((r) => r.text);

  // Simple tokenization and signal computation (reuse from rebuild-persona)
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

  const phrases = topPhrases(texts, 12);
  const promoRate = ratePromo(texts);
  const specificityRate = rateSpecific(texts);
  const firstPersonRate = rateFirstPerson(texts);

  const tone =
    subredditId === "MachineLearning" ? "technical, evidence-driven" :
    subredditId === "technology" ? "skeptical, discussion-oriented" :
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

  const weights = {
    salesyPenaltyWeight: 0.9 + promoRate,
    vaguenessPenaltyWeight: 0.9,
    normBonusWeight: 1.1 + specificityRate * 0.5,
    lengthPenaltyWeight: 0.6
  };

  const thresholds = {
    removed: 0.25 - promoRate * 0.05,
    ignored: 0.45,
    discussed: 0.7
  };

  const lastSignals = {
    promoRate,
    specificityRate,
    firstPersonRate,
    topPhrases: phrases.slice(0, 8),
  };

  const { error: upsertErr } = await supabaseAdmin
    .from("subreddit_personas")
    .upsert({
      subreddit_id: subredditId,
      name: `r/${subredditId === "MachineLearning" ? "MachineLearning" : subredditId}`,
      tone,
      norms,
      failure_triggers,
      example_phrases: phrases,
      weights,
      thresholds,
      last_signals: lastSignals,
      updated_at: new Date().toISOString()
    } as any, { onConflict: "subreddit_id" });

  if (upsertErr) {
    throw new Error(upsertErr.message);
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { subredditId, text } = await req.json().catch(() => ({ subredditId: "", text: "" }));
  const id = String(subredditId || "").trim();
  const inputText = String(text || "").trim();

  if (!id || !inputText) {
    return NextResponse.json({ error: "subredditId and text required" }, { status: 400 });
  }

  try {
    // Step 1: Run simulation BEFORE training
    const before = await simulatePost({
      text: inputText,
      subredditId: id,
      trainingVersion: "before",
    });

    // Step 2: Rebuild persona
    await rebuildPersonaInternal(id);

    // Step 3: Run simulation AFTER training
    const after = await simulatePost({
      text: inputText,
      subredditId: id,
      trainingVersion: "after",
    });

    // Step 4: Compute diff
    const outcomeChanged = before.outcome !== after.outcome;
    const scoreDelta = after.score - before.score;
    const beforeReasons = new Set(before.reasons);
    const afterReasons = new Set(after.reasons);
    const reasonsAdded = after.reasons.filter(r => !beforeReasons.has(r));
    const reasonsRemoved = before.reasons.filter(r => !afterReasons.has(r));

    return NextResponse.json({
      ok: true,
      before,
      after,
      diff: {
        outcomeChanged,
        scoreDelta: Math.round(scoreDelta * 100) / 100,
        reasonsAdded,
        reasonsRemoved,
      },
    });
  } catch (error) {
    console.error("Proof run error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
