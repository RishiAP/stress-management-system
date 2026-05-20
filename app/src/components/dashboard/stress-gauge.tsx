"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StressGaugeProps {
  score: number | null;
  category: string | null;
}

const CATEGORY_CONFIG = {
  "Low Stress": {
    color: "text-emerald-500",
    ring: "stroke-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Low Stress",
  },
  "Moderate Stress": {
    color: "text-amber-500",
    ring: "stroke-amber-500",
    bg: "bg-amber-500/10",
    label: "Moderate Stress",
  },
  "High Stress": {
    color: "text-rose-500",
    ring: "stroke-rose-500",
    bg: "bg-rose-500/10",
    label: "High Stress",
  },
};

export function StressGauge({ score, category }: StressGaugeProps) {
  const config =
    category && category in CATEGORY_CONFIG
      ? CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]
      : null;

  // SVG arc gauge math
  const radius = 72;
  const circumference = Math.PI * radius; // half circle
  const pct = score !== null ? Math.min(Math.max(score, 0), 100) / 100 : 0;
  const offset = circumference * (1 - pct);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Stress Score
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 pt-4">
        {/* Arc gauge */}
        <div className="relative">
          <svg
            width="180"
            height="100"
            viewBox="0 0 180 100"
            className="overflow-visible"
          >
            {/* Background track */}
            <path
              d="M 10 90 A 80 80 0 0 1 170 90"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              strokeLinecap="round"
              className="text-muted/40"
            />
            {/* Value arc */}
            <path
              d="M 10 90 A 80 80 0 0 1 170 90"
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(
                "transition-all duration-700",
                config?.ring ?? "stroke-muted-foreground/30"
              )}
            />
          </svg>

          {/* Score in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
            <span
              className={cn(
                "text-4xl font-bold tabular-nums transition-colors",
                config?.color ?? "text-muted-foreground"
              )}
            >
              {score !== null ? Math.round(score) : "--"}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>

        {/* Category badge */}
        <div
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            config?.bg ?? "bg-muted",
            config?.color ?? "text-muted-foreground"
          )}
        >
          {config?.label ?? (score === null ? "Waiting for data…" : "Unknown")}
        </div>
      </CardContent>
    </Card>
  );
}
