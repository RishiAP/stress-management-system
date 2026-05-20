"use client";

import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

interface LastUpdatedBadgeProps {
  lastUpdated: Date | null;
  isLoading: boolean;
}

function formatRelative(date: Date) {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

export function LastUpdatedBadge({ lastUpdated, isLoading }: LastUpdatedBadgeProps) {
  return (
    <Badge variant="secondary" className="gap-1.5 text-xs font-normal">
      <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
      {lastUpdated
        ? `Updated ${formatRelative(lastUpdated)}`
        : isLoading
          ? "Loading…"
          : "Waiting for data"}
    </Badge>
  );
}
