"use client";

import { useState, useEffect } from "react";
import { subreddits, getSubredditById } from "@/data/subreddits";
import { copyToClipboard } from "@/lib/copy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultCard } from "@/components/ResultCard";

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
  agentRationale?: string;
  memory?: {
    examplesObserved?: number;
    lastTrainedAt?: string;
  };
  personaSnapshot?: {
    name?: string;
    subredditId?: string;
    signalsFromTraining?: {
      promoRate?: number;
      specificityRate?: number;
      firstPersonRate?: number;
      topPhrases?: string[];
    };
    topPhrases?: string[];
    weights?: Record<string, number>;
    thresholds?: Record<string, number>;
    memory?: {
      examplesCount?: number;
      lastTrainedAt?: string;
    };
  };
}

interface BatchResult extends SimulationResult {
  subredditId: string;
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

const DEMO_SUBREDDITS = ["startups", "MachineLearning", "technology"];

export default function Home() {
  const [text, setText] = useState("");
  const [subredditId, setSubredditId] = useState("startups");
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<SimulationResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [lastRunType, setLastRunType] = useState<"single" | "batch" | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedBatchIndex, setCopiedBatchIndex] = useState<{ subredditId: string; index: number } | null>(null);

  const handleSimulate = async () => {
    if (!text.trim()) {
      alert("Please enter some text to simulate");
      return;
    }

    setLoading(true);
    setSingleResult(null);
    setBatchResults(null);
    setLastRunType(null);

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
      setSingleResult(data);
      setLastRunType("single");
    } catch (error) {
      console.error("Simulation error:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSimulate = async () => {
    if (!text.trim()) {
      alert("Please enter some text to simulate");
      return;
    }

    setBatchLoading(true);
    setSingleResult(null);
    setBatchResults(null);
    setLastRunType(null);

    try {
      const response = await fetch("/api/simulate-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Batch simulation failed");
      }

      const data = await response.json();
      if (data.ok && data.results) {
        setBatchResults(data.results.filter((r: any) => !r.error));
        setLastRunType("batch");
      }
    } catch (error) {
      console.error("Batch simulation error:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setBatchLoading(false);
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

  const handleBatchCopy = async (rewriteText: string, subredditId: string, index: number) => {
    const success = await copyToClipboard(rewriteText);
    if (success) {
      setCopiedBatchIndex({ subredditId, index });
      setTimeout(() => setCopiedBatchIndex(null), 2000);
    }
  };

  const currentResult = lastRunType === "batch" ? null : singleResult;
  const hasResults = currentResult || batchResults;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Simulator</h1>
            <p className="text-sm text-muted-foreground">Agentic Reddit post performance testing</p>
          </div>
          <div className="flex items-center gap-2">
            {currentResult?.personaSource && (
              <Badge variant={currentResult.personaSource === "supabase" ? "default" : "secondary"}>
                {currentResult.personaSource === "supabase" ? "Trained" : "Static"}
              </Badge>
            )}
            <Badge variant="outline">Agent Active</Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Draft Card */}
          <Card>
            <CardHeader>
              <CardTitle>Draft Post</CardTitle>
              <CardDescription>
                Agent will apply community-specific policy + memory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="subreddit" className="block text-sm font-medium mb-2">
                  Select Subreddit
                </label>
                <select
                  id="subreddit"
                  value={subredditId}
                  onChange={(e) => setSubredditId(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={loading || batchLoading}
                >
                  {subreddits.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="text" className="block text-sm font-medium mb-2">
                  Post Content
                </label>
                <textarea
                  id="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  placeholder="Paste your draft post here..."
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  disabled={loading || batchLoading}
                />
                <p className="mt-1 text-xs text-muted-foreground">{text.length} characters</p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Try Examples:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_POSTS.map((example, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleExampleClick(example.text, example.subredditId)}
                      disabled={loading || batchLoading}
                    >
                      {example.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSimulate}
                  disabled={loading || batchLoading || !text.trim()}
                  className="flex-1"
                >
                  {loading ? "Agent running..." : "Simulate"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBatchSimulate}
                  disabled={loading || batchLoading || !text.trim()}
                  className="flex-1"
                >
                  {batchLoading ? "Running..." : "Run in all 3 communities"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Card */}
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {loading || batchLoading
                  ? "Agent analyzing your post..."
                  : hasResults
                  ? "Simulation results and agent insights"
                  : "Run a simulation to see how the agent reacts."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(loading || batchLoading) && (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              )}

              {!loading && !batchLoading && hasResults && (
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="rewrites">Rewrites</TabsTrigger>
                    <TabsTrigger value="agent">Agent</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="space-y-4 mt-4">
                    {currentResult ? (
                      <ResultCard
                        title={getSubredditById(subredditId)?.name || subredditId}
                        outcome={currentResult.outcome}
                        confidence={currentResult.confidence}
                        score={currentResult.score}
                        reasons={currentResult.reasons}
                        bestRewrite={
                          currentResult.rewrites[0]
                            ? {
                                text: currentResult.rewrites[0].text,
                                label: currentResult.rewrites[0].label,
                              }
                            : undefined
                        }
                        personaSource={currentResult.personaSource}
                        onCopyRewrite={
                          currentResult.rewrites[0]
                            ? () => handleCopy(currentResult.rewrites[0].text, 0)
                            : undefined
                        }
                        copied={copiedIndex === 0}
                      />
                    ) : batchResults ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {batchResults.map((result) => {
                          const subreddit = getSubredditById(result.subredditId);
                          return (
                            <ResultCard
                              key={result.subredditId}
                              title={subreddit?.name || result.subredditId}
                              outcome={result.outcome}
                              confidence={result.confidence}
                              score={result.score}
                              reasons={result.reasons}
                              bestRewrite={
                                result.rewrites[0]
                                  ? {
                                      text: result.rewrites[0].text,
                                      label: result.rewrites[0].label,
                                    }
                                  : undefined
                              }
                              personaSource={result.personaSource}
                              onCopyRewrite={
                                result.rewrites[0]
                                  ? () => handleBatchCopy(result.rewrites[0].text, result.subredditId, 0)
                                  : undefined
                              }
                              copied={
                                copiedBatchIndex?.subredditId === result.subredditId &&
                                copiedBatchIndex?.index === 0
                              }
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="rewrites" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {(currentResult?.rewrites || batchResults?.[0]?.rewrites || []).length > 0 ? (
                          (currentResult?.rewrites || batchResults?.[0]?.rewrites || []).map((rewrite, idx) => (
                            <Card key={idx}>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base">{rewrite.label}</CardTitle>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      currentResult
                                        ? handleCopy(rewrite.text, idx)
                                        : batchResults?.[0]
                                        ? handleBatchCopy(rewrite.text, batchResults[0].subredditId, idx)
                                        : undefined
                                    }
                                  >
                                    {((currentResult && copiedIndex === idx) ||
                                      (batchResults?.[0] &&
                                        copiedBatchIndex?.subredditId === batchResults[0].subredditId &&
                                        copiedBatchIndex?.index === idx))
                                      ? "Copied!"
                                      : "Copy"}
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <p className="text-sm text-muted-foreground mb-2 italic">{rewrite.rationale}</p>
                                <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                                  {rewrite.text}
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No rewrites available.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="agent" className="mt-4">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="w-full text-left font-semibold text-sm mb-2">
                        Show agent details
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4">
                        <Card>
                          <CardContent className="pt-6 space-y-4">
                            {(currentResult?.personaSource || batchResults?.[0]?.personaSource) && (
                              <div>
                                <span className="text-sm font-medium">Persona Source: </span>
                                <Badge
                                  variant={
                                    (currentResult?.personaSource || batchResults?.[0]?.personaSource) === "supabase"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {(currentResult?.personaSource || batchResults?.[0]?.personaSource) === "supabase"
                                    ? "Trained (Supabase)"
                                    : "Static fallback"}
                                </Badge>
                              </div>
                            )}

                            {(currentResult?.memory?.examplesObserved !== undefined ||
                              batchResults?.[0]?.memory?.examplesObserved !== undefined) && (
                              <div>
                                <span className="text-sm font-medium">Examples Observed: </span>
                                <span className="text-sm">
                                  {currentResult?.memory?.examplesObserved ||
                                    batchResults?.[0]?.memory?.examplesObserved}
                                </span>
                              </div>
                            )}

                            {(currentResult?.memory?.lastTrainedAt ||
                              batchResults?.[0]?.memory?.lastTrainedAt) && (
                              <div>
                                <span className="text-sm font-medium">Last Trained: </span>
                                <span className="text-sm">
                                  {new Date(
                                    currentResult?.memory?.lastTrainedAt ||
                                      batchResults?.[0]?.memory?.lastTrainedAt ||
                                      ""
                                  ).toLocaleString()}
                                </span>
                              </div>
                            )}

                            {(currentResult?.agentRationale || batchResults?.[0]?.agentRationale) && (
                              <>
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-semibold mb-2">Why the agent decided this</h4>
                                  <p className="text-sm text-muted-foreground italic">
                                    {currentResult?.agentRationale || batchResults?.[0]?.agentRationale}
                                  </p>
                                </div>
                              </>
                            )}

                            {(currentResult?.personaSnapshot || batchResults?.[0]?.personaSnapshot) && (
                              <>
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-semibold mb-2">Policy Snapshot</h4>
                                  {(currentResult?.personaSnapshot?.signalsFromTraining?.topPhrases ||
                                    currentResult?.personaSnapshot?.topPhrases ||
                                    batchResults?.[0]?.personaSnapshot?.topPhrases) && (
                                    <div className="mb-4">
                                      <p className="text-xs text-muted-foreground mb-2">Top Phrases:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {(
                                          currentResult?.personaSnapshot?.signalsFromTraining?.topPhrases ||
                                          currentResult?.personaSnapshot?.topPhrases ||
                                          batchResults?.[0]?.personaSnapshot?.topPhrases ||
                                          []
                                        )
                                          .slice(0, 8)
                                          .map((phrase, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">
                                              {phrase}
                                            </Badge>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {(currentResult?.personaSnapshot?.weights ||
                                    batchResults?.[0]?.personaSnapshot?.weights) && (
                                    <div className="mb-4">
                                      <p className="text-xs text-muted-foreground mb-2">Weights:</p>
                                      <div className="bg-muted rounded-md p-2 font-mono text-xs space-y-1">
                                        {Object.entries(
                                          currentResult?.personaSnapshot?.weights ||
                                            batchResults?.[0]?.personaSnapshot?.weights ||
                                            {}
                                        ).map(([key, value]) => (
                                          <div key={key} className="flex justify-between">
                                            <span>{key}:</span>
                                            <span>{value.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {(currentResult?.personaSnapshot?.thresholds ||
                                    batchResults?.[0]?.personaSnapshot?.thresholds) && (
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2">Thresholds:</p>
                                      <div className="bg-muted rounded-md p-2 font-mono text-xs space-y-1">
                                        {Object.entries(
                                          currentResult?.personaSnapshot?.thresholds ||
                                            batchResults?.[0]?.personaSnapshot?.thresholds ||
                                            {}
                                        ).map(([key, value]) => (
                                          <div key={key} className="flex justify-between">
                                            <span>{key}:</span>
                                            <span>{value.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>
                  </TabsContent>
                </Tabs>
              )}

              {!loading && !batchLoading && !hasResults && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Run a simulation to see how the agent reacts.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
