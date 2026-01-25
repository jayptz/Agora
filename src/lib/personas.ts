import { Subreddit, getSubredditById, subreddits } from "@/data/subreddits";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Load persona from Supabase first, fallback to static data
 * Returns the persona and a flag indicating the source
 */
export async function loadPersona(
  subredditId: string
): Promise<{ persona: Subreddit | null; source: "supabase" | "static" | null }> {
  const supabase = getSupabaseAdmin();

  // Try Supabase first if configured
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("subreddit_personas")
        .select("*")
        .eq("subreddit_id", subredditId)
        .single();

      if (!error && data) {
        // Convert JSONB arrays back to string arrays
        const persona: Subreddit = {
          id: data.subreddit_id,
          name: data.name,
          tone: data.tone,
          norms: Array.isArray(data.norms) ? data.norms : [],
          failureTriggers: Array.isArray(data.failure_triggers)
            ? data.failure_triggers
            : [],
          examplePhrases: Array.isArray(data.example_phrases)
            ? data.example_phrases
            : [],
        };
        return { persona, source: "supabase" };
      }
    } catch (error) {
      console.error("Error loading persona from Supabase:", error);
      // Fall through to static fallback
    }
  }

  // Fallback to static data
  const staticPersona = getSubredditById(subredditId);
  return {
    persona: staticPersona || null,
    source: staticPersona ? "static" : null,
  };
}

/**
 * Save simulation run to Supabase (best-effort, doesn't throw)
 */
export async function saveSimulationRun(
  subredditId: string,
  inputText: string,
  score: number,
  outcome: string,
  confidence: string,
  reasons: string[],
  rewrites: Array<{ label: string; text: string; rationale: string }>
): Promise<{ success: boolean; runId?: string }> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return { success: false };
  }

  try {
    const { data, error } = await supabase
      .from("simulation_runs")
      .insert({
        subreddit_id: subredditId,
        input_text: inputText,
        score,
        outcome,
        confidence,
        reasons,
        rewrites,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error saving simulation run:", error);
      return { success: false };
    }

    return { success: true, runId: data?.id };
  } catch (error) {
    console.error("Error saving simulation run:", error);
    return { success: false };
  }
}
