"use client";

import { useState, useEffect } from "react";
import { subreddits } from "@/data/subreddits";
import { copyToClipboard } from "@/lib/copy";

type Outcome = "Removed" | "Ignored" | "Discussed" | "Upvoted";
type Confidence = "Low" | "Medium" | "High";

interface Rewrite {
  label: string;
  text: string;
  rationale: string;
}

interface SimulationResult {
  outcome: Outcome;
  confidence: Confidence;
  score: number;
  reasons: string[];
  rewrites: Rewrite[];
  personaSource?: "supabase" | "static";
}

const EXAMPLE_POSTS = [
  {
    label: "Startup Lesson",
    text: "I built an MVP in 2 weeks and got 100 users. Here's what I learned: focus on one feature, talk to users daily, and iterate fast. The key was shipping early and getting feedback.",
    subredditId: "startups"
  },
  {
    label: "Salesy Post",
    text: "🚀 Revolutionary new tool that will change your life! Sign up now for exclusive early access. Limited time offer - don't miss out! Click here to join thousands of happy users.",
    subredditId: "startups"
  },
  {
    label: "Tech Question",
    text: "I'm trying to understand how to implement a neural network from scratch. I've read a few papers but struggling with backpropagation. Can someone explain the math behind gradient descent in simple terms?",
    subredditId: "MachineLearning"
  }
];

// Demo subreddits for Phase 2
const DEMO_SUBREDDITS = ["startups", "MachineLearning", "technology"];

export default function Home() {
  const [text, setText] = useState("");
  const [subredditId, setSubredditId] = useState("startups");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  // Admin panel state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminExamples, setAdminExamples] = useState("");
  const [adminSubredditId, setAdminSubredditId] = useState("startups");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [lastSignals, setLastSignals] = useState<any>(null);

  // Check for admin query param on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setIsAdmin(params.get("admin") === "1");
    }
  }, []);

  const handleSimulate = async () => {
    if (!text.trim()) {
      alert("Please enter some text to simulate");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, subredditId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Simulation failed");
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error("Simulation error:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleText: string, exampleSubredditId: string) => {
    setText(exampleText);
    setSubredditId(exampleSubredditId);
  };

  const handleCopy = async (rewriteText: string, index: number) => {
    const success = await copyToClipboard(rewriteText);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const getOutcomeColor = (outcome: Outcome) => {
    switch (outcome) {
      case "Removed":
        return "bg-red-100 text-red-800 border-red-300";
      case "Ignored":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "Discussed":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Upvoted":
        return "bg-green-100 text-green-800 border-green-300";
    }
  };

  const getConfidenceColor = (confidence: Confidence) => {
    switch (confidence) {
      case "High":
        return "bg-green-500";
      case "Medium":
        return "bg-yellow-500";
      case "Low":
        return "bg-red-500";
    }
  };

  const handleAddExamples = async () => {
    if (!adminExamples.trim()) {
      setAdminMessage("Please enter some examples");
      return;
    }

    const examples = adminExamples
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (examples.length === 0) {
      setAdminMessage("Please enter at least one example");
      return;
    }

    if (examples.length > 100) {
      setAdminMessage("Maximum 100 examples per call");
      return;
    }

    setAdminLoading(true);
    setAdminMessage(null);

    try {
      const adminSecret = prompt("Enter ADMIN_SECRET:");
      if (!adminSecret) {
        setAdminMessage("Admin secret required");
        return;
      }

      const response = await fetch("/api/admin/add-examples", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          subredditId: adminSubredditId,
          examples,
          label: "neutral",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add examples");
      }

      setAdminMessage(`✅ Added ${data.count} examples for ${adminSubredditId}`);
      setAdminExamples("");
    } catch (error) {
      console.error("Add examples error:", error);
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRebuildPersona = async () => {
    setAdminLoading(true);
    setAdminMessage(null);

    try {
      const adminSecret = prompt("Enter ADMIN_SECRET:");
      if (!adminSecret) {
        setAdminMessage("Admin secret required");
        return;
      }

      const response = await fetch("/api/admin/rebuild-persona", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          subredditId: adminSubredditId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to rebuild persona");
      }

      setLastSignals(data.signals);
      setAdminMessage(
        `✅ Persona rebuilt for ${adminSubredditId}. Used ${data.exampleCount} examples.`
      );
    } catch (error) {
      console.error("Rebuild persona error:", error);
      setAdminMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AgoraSim</h1>
          <p className="text-gray-600">Simulate how your Reddit post will perform before posting</p>
        </header>

        {isAdmin && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Admin Panel (Phase 2 Training)</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subreddit (Demo: startups, MachineLearning, technology)
              </label>
              <select
                value={adminSubredditId}
                onChange={(e) => setAdminSubredditId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {DEMO_SUBREDDITS.map((id) => {
                  const sub = subreddits.find((s) => s.id === id);
                  return (
                    <option key={id} value={id}>
                      {sub?.name || id}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste Examples (one per line, max 100 per call, max 2000 chars each)
              </label>
              <textarea
                value={adminExamples}
                onChange={(e) => setAdminExamples(e.target.value)}
                rows={8}
                placeholder="Paste community examples here, one per line..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y font-mono text-sm"
              />
              <p className="mt-1 text-sm text-gray-500">
                {adminExamples.split("\n").filter((l) => l.trim().length > 0).length} examples
              </p>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={handleAddExamples}
                disabled={adminLoading || !adminExamples.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md transition-colors"
              >
                {adminLoading ? "Processing..." : "Add Examples"}
              </button>
              <button
                onClick={handleRebuildPersona}
                disabled={adminLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md transition-colors"
              >
                {adminLoading ? "Training..." : "Rebuild Persona"}
              </button>
            </div>

            {adminMessage && (
              <div
                className={`p-3 rounded-md mb-4 ${
                  adminMessage.startsWith("✅")
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {adminMessage}
              </div>
            )}

            {lastSignals && (
              <div className="bg-white border border-gray-200 rounded-md p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Last Training Signals:</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Promo Rate:</span>{" "}
                    <span className="font-mono">{(lastSignals.promoRate * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Specificity Rate:</span>{" "}
                    <span className="font-mono">{(lastSignals.specificityRate * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Length:</span>{" "}
                    <span className="font-mono">{lastSignals.avgLen} chars</span>
                  </div>
                  <div>
                    <span className="text-gray-600">First Person Rate:</span>{" "}
                    <span className="font-mono">{(lastSignals.firstPersonRate * 100).toFixed(1)}%</span>
                  </div>
                </div>
                {lastSignals.topPhrases && lastSignals.topPhrases.length > 0 && (
                  <div className="mt-3">
                    <span className="text-gray-600 text-sm">Top Phrases:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lastSignals.topPhrases.slice(0, 10).map((phrase: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                        >
                          {phrase}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4">
            <label htmlFor="subreddit" className="block text-sm font-medium text-gray-700 mb-2">
              Select Subreddit
            </label>
            <select
              id="subreddit"
              value={subredditId}
              onChange={(e) => setSubredditId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {subreddits.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="text" className="block text-sm font-medium text-gray-700 mb-2">
              Draft Post
            </label>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste your draft post here..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
            />
            <p className="mt-1 text-sm text-gray-500">{text.length} characters</p>
          </div>

          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Try Examples:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_POSTS.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(example.text, example.subredditId)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={loading || !text.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-md transition-colors"
          >
            {loading ? "Simulating..." : "Simulate Community Reaction"}
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-gray-900">Results</h2>
                  {result.personaSource && (
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-mono">
                      Persona: {result.personaSource === "supabase" ? "Supabase" : "Local"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-4 py-2 rounded-lg border-2 font-semibold text-lg ${getOutcomeColor(result.outcome)}`}>
                    {result.outcome}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Confidence:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getConfidenceColor(result.confidence)}`}>
                      {result.confidence}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600 mb-1">Score</div>
                <div className="text-2xl font-bold text-gray-900">{result.score.toFixed(2)}</div>
                <div className="w-32 h-2 bg-gray-200 rounded-full mt-2">
                  <div
                    className={`h-full rounded-full ${getConfidenceColor(result.confidence)}`}
                    style={{ width: `${result.score * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Reasons</h3>
              <ul className="space-y-2">
                {result.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    <span className="text-gray-700">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Rewrite Variants</h3>
              <div className="space-y-4">
                {result.rewrites.map((rewrite, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{rewrite.label}</span>
                      <button
                        onClick={() => handleCopy(rewrite.text, idx)}
                        className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                      >
                        {copiedIndex === idx ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 italic">{rewrite.rationale}</p>
                    <div className="bg-gray-50 rounded p-3 text-gray-800 whitespace-pre-wrap text-sm">
                      {rewrite.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
