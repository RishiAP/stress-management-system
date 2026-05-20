"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Clock } from "lucide-react";

interface DeviceStatusCardProps {
  deviceName: string | null;
  isOnline: boolean;
  lastSeen: string | null;
}

function formatRelative(dateStr: string) {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 10) return "Just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function DeviceStatusCard({
  deviceName,
  isOnline,
  lastSeen,
}: DeviceStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-0 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Active Device
        </CardTitle>
        {isOnline ? (
          <Wifi className="h-4 w-4 text-emerald-500" />
        ) : (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        <div>
          <span className="text-xl font-semibold">
            {deviceName ?? "No device"}
          </span>
        </div>

        <Badge
          variant={isOnline ? "default" : "secondary"}
          className="gap-1"
        >
          {isOnline ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {isOnline ? "Sending data" : "Offline"}
        </Badge>

        {lastSeen && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Last data: {formatRelative(lastSeen)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
