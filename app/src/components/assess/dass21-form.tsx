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

  if (result) {
    const stressLevel =
      result.stressRaw <= 14
        ? "Normal"
        : result.stressRaw <= 18
          ? "Mild"
          : result.stressRaw <= 25
            ? "Moderate"
            : result.stressRaw <= 33
              ? "Severe"
              : "Extremely Severe";

    const levelColor =
      result.stressRaw <= 14
        ? "default"
        : result.stressRaw <= 18
          ? "secondary"
          : result.stressRaw <= 25
            ? "outline"
            : "destructive";

    return (
      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Assessment Complete</CardTitle>
          <CardDescription>
            Your psychological stress subscale results
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="text-5xl font-bold tabular-nums">
              {result.stressRaw}
              <span className="text-xl text-muted-foreground font-normal">
                /42
              </span>
            </div>
            <Badge variant={levelColor as "default" | "secondary" | "outline" | "destructive"}>
              {stressLevel} Stress
            </Badge>
            <p className="text-sm text-muted-foreground text-center">
              This score adjusts your physiological stress readings by up to{" "}
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
