"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { copyToClipboard } from "@/lib/copy";

export type Outcome = "Removed" | "Ignored" | "Discussed" | "Upvoted";
export type Confidence = "Low" | "Medium" | "High";

interface ResultCardProps {
  title: string;
  outcome: Outcome;
  confidence: Confidence;
  score: number;
  reasons: string[];
  bestRewrite?: { text: string; label: string };
  personaSource?: "supabase" | "static";
  onCopyRewrite?: () => void;
  copied?: boolean;
}

const getOutcomeVariant = (outcome: Outcome): "default" | "secondary" | "destructive" | "outline" => {
  switch (outcome) {
    case "Removed":
      return "destructive";
    case "Ignored":
      return "secondary";
    case "Discussed":
      return "default";
    case "Upvoted":
      return "default";
  }
};

const getConfidenceVariant = (confidence: Confidence): "default" | "secondary" | "destructive" | "outline" => {
  switch (confidence) {
    case "High":
      return "default";
    case "Medium":
      return "secondary";
    case "Low":
      return "destructive";
  }
};

export function ResultCard({
  title,
  outcome,
  confidence,
  score,
  reasons,
  bestRewrite,
  personaSource,
  onCopyRewrite,
  copied,
}: ResultCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getOutcomeVariant(outcome)}>{outcome}</Badge>
            <Badge variant={getConfidenceVariant(confidence)}>{confidence}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Score</span>
            <span className="font-semibold">{score.toFixed(2)}</span>
          </div>
          <Progress value={score * 100} max={100} className="h-2" />
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Top Reasons</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {reasons.slice(0, 3).map((reason, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-primary mr-2 font-bold">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {bestRewrite && onCopyRewrite && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyRewrite}
            className="w-full"
          >
            {copied ? "Copied!" : `Copy best rewrite (${bestRewrite.label})`}
          </Button>
        )}
      </CardContent>
      {personaSource && (
        <CardFooter className="text-xs text-muted-foreground">
          Policy: {personaSource === "supabase" ? "Trained" : "Static"}
        </CardFooter>
      )}
    </Card>
  );
}
