"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StressGaugeProps {
  score: number | null;
  category: string | null;
  isLive?: boolean;
}

const CATEGORY_CONFIG = {
  "Low Stress": {
    color: "text-emerald-500",
    gradientStart: "#10b981",
    gradientEnd: "#34d399",
    glowColor: "rgba(16, 185, 129, 0.3)",
    bg: "bg-emerald-500/10",
    label: "Low Stress",
    emoji: "😌",
  },
  "Moderate Stress": {
    color: "text-amber-500",
    gradientStart: "#f59e0b",
    gradientEnd: "#fbbf24",
    glowColor: "rgba(245, 158, 11, 0.3)",
    bg: "bg-amber-500/10",
    label: "Moderate Stress",
    emoji: "😐",
  },
  "High Stress": {
    color: "text-rose-500",
    gradientStart: "#ef4444",
    gradientEnd: "#f87171",
    glowColor: "rgba(239, 68, 68, 0.3)",
    bg: "bg-rose-500/10",
    label: "High Stress",
    emoji: "😰",
  },
};

export function StressGauge({ score, category, isLive = true }: StressGaugeProps) {
  const baseConfig =
    category && category in CATEGORY_CONFIG
      ? CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]
      : null;

  // If not live, mute the colors
  const config = !isLive && baseConfig ? {
    ...baseConfig,
    color: "text-muted-foreground",
    gradientStart: "#6b7280",
    gradientEnd: "#9ca3af",
    bg: "bg-muted",
  } : baseConfig;

  // Full circle gauge
  const radius = 68;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const pct = score !== null ? Math.min(Math.max(score, 0), 100) / 100 : 0;
  const offset = circumference * (1 - pct);
  const gradientId = "stress-gradient";

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Stress Score
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 pt-4">
        {/* Circular gauge */}
        <div className="relative w-[180px] h-[180px]">
          <svg
            width="180"
            height="180"
            viewBox="0 0 180 180"
            className="overflow-visible -rotate-90"
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop
                  offset="0%"
                  stopColor={config?.gradientStart ?? "#6b7280"}
                />
                <stop
                  offset="100%"
                  stopColor={config?.gradientEnd ?? "#9ca3af"}
                />
              </linearGradient>
              {config && (
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              )}
            </defs>

            {/* Background track */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted/20"
            />

            {/* Tick marks */}
            {Array.from({ length: 20 }).map((_, i) => {
              const angle = (i / 20) * 360;
              const rad = (angle * Math.PI) / 180;
              const innerR = radius - strokeWidth / 2 - 2;
              const outerR = radius - strokeWidth / 2 - (i % 5 === 0 ? 8 : 5);
              return (
                <line
                  key={i}
                  x1={90 + innerR * Math.cos(rad)}
                  y1={90 + innerR * Math.sin(rad)}
                  x2={90 + outerR * Math.cos(rad)}
                  y2={90 + outerR * Math.sin(rad)}
                  stroke="currentColor"
                  strokeWidth={i % 5 === 0 ? 1.5 : 0.8}
                  className="text-muted-foreground/20"
                />
              );
            })}

            {/* Value arc */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              filter={config ? "url(#glow)" : undefined}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Score in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg mb-0.5">{config?.emoji ?? "⏳"}</span>
            <span
              className={cn(
                "text-4xl font-bold tabular-nums transition-colors leading-none",
                config?.color ?? "text-muted-foreground"
              )}
            >
              {score !== null ? Math.round(score) : "--"}
            </span>
            <span className="text-[10px] text-muted-foreground mt-1 tracking-wider uppercase">
              of 100
            </span>
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
