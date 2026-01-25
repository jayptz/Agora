"use client";

import { useState } from "react";
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

export default function Home() {
  const [text, setText] = useState("");
  const [subredditId, setSubredditId] = useState("startups");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">AgoraSim</h1>
          <p className="text-gray-600">Simulate how your Reddit post will perform before posting</p>
        </header>

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
