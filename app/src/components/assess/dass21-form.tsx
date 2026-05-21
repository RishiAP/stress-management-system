"use client";

import { useState } from "react";
import { DASS21_QUESTIONS, DASS21_ANSWER_LABELS } from "@/lib/dass21";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DassResult {
  id: string;
  stressRaw: number;
  anxietyRaw: number;
  depressionRaw: number;
  dassModifier: number;
  createdAt: string;
}

interface Dass21FormProps {
  onComplete?: (result: DassResult) => void;
}

export function Dass21Form({ onComplete }: Dass21FormProps) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(21).fill(null)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<DassResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = answers.filter((a) => a !== null).length;
  const progress = Math.round((answeredCount / 21) * 100);
  const allAnswered = answeredCount === 21;

  function setAnswer(questionIdx: number, value: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIdx] = value;
      return next;
    });
  }

  async function handleSubmit() {
    if (!allAnswered) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Submission failed");
      }

      const data: DassResult = await res.json();
      setResult(data);
      onComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getLevel(score: number, type: 'stress' | 'anxiety' | 'depression') {
    if (type === 'stress') {
      return score <= 14 ? "Normal" : score <= 18 ? "Mild" : score <= 25 ? "Moderate" : score <= 33 ? "Severe" : "Extremely Severe";
    }
    if (type === 'anxiety') {
      return score <= 7 ? "Normal" : score <= 9 ? "Mild" : score <= 14 ? "Moderate" : score <= 19 ? "Severe" : "Extremely Severe";
    }
    if (type === 'depression') {
      return score <= 9 ? "Normal" : score <= 13 ? "Mild" : score <= 20 ? "Moderate" : score <= 27 ? "Severe" : "Extremely Severe";
    }
    return "Normal";
  }

  function getColor(score: number, type: 'stress' | 'anxiety' | 'depression'): "default" | "secondary" | "outline" | "destructive" {
    const level = getLevel(score, type);
    if (level === "Normal") return "default";
    if (level === "Mild") return "secondary";
    if (level === "Moderate") return "outline";
    return "destructive";
  }

  if (result) {
    const stressLevel = getLevel(result.stressRaw, 'stress');
    const anxietyLevel = getLevel(result.anxietyRaw, 'anxiety');
    const depressionLevel = getLevel(result.depressionRaw, 'depression');

    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Assessment Complete</CardTitle>
          <CardDescription>
            Your DASS-21 Subscale Results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Stress */}
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Stress</span>
              <div className="text-4xl font-bold tabular-nums">
                {result.stressRaw}
              </div>
              <Badge variant={getColor(result.stressRaw, 'stress')}>
                {stressLevel}
              </Badge>
            </div>

            {/* Anxiety */}
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Anxiety</span>
              <div className="text-4xl font-bold tabular-nums">
                {result.anxietyRaw}
              </div>
              <Badge variant={getColor(result.anxietyRaw, 'anxiety')}>
                {anxietyLevel}
              </Badge>
            </div>

            {/* Depression */}
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Depression</span>
              <div className="text-4xl font-bold tabular-nums">
                {result.depressionRaw}
              </div>
              <Badge variant={getColor(result.depressionRaw, 'depression')}>
                {depressionLevel}
              </Badge>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-3 mt-6">
            <p className="text-sm text-muted-foreground text-center">
              Your Stress score adjusts your live physiological readings by up to{" "}
              <strong>{(result.dassModifier * 100).toFixed(1)}%</strong>
            </p>
          </div>

          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              setResult(null);
              setAnswers(Array(21).fill(null));
            }}
          >
            Retake Assessment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Progress bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{answeredCount} / 21</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        {DASS21_QUESTIONS.map((question, idx) => (
          <Card
            key={idx}
            className={
              answers[idx] !== null
                ? "border-primary/30 bg-primary/5"
                : ""
            }
          >
            <CardContent className="pt-5">
              <p className="text-sm font-medium mb-4">
                <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                {question}
              </p>
              <RadioGroup
                value={answers[idx]?.toString() ?? ""}
                onValueChange={(val) => setAnswer(idx, parseInt(val))}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {DASS21_ANSWER_LABELS.map((opt) => (
                  <div key={opt.value} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={opt.value.toString()}
                      id={`q${idx}-a${opt.value}`}
                    />
                    <Label
                      htmlFor={`q${idx}-a${opt.value}`}
                      className="cursor-pointer text-sm"
                    >
                      {opt.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {/* Submit */}
      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={!allAnswered || isSubmitting}
      >
        {isSubmitting
          ? "Submitting…"
          : !allAnswered
            ? `Answer ${21 - answeredCount} more question${21 - answeredCount === 1 ? "" : "s"}`
            : "Submit Assessment"}
      </Button>
    </div>
  );
}
