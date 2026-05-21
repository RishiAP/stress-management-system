"use client";

import { usePolling } from "@/hooks/use-polling";
import { StressGauge } from "@/components/dashboard/stress-gauge";
import { HeartRateCard } from "@/components/dashboard/heart-rate-card";
import { SignalChart } from "@/components/dashboard/signal-chart";
import { LastUpdatedBadge } from "@/components/dashboard/last-updated-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WifiOff, Hand, Activity } from "lucide-react";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-0">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Skeleton className="h-[180px] w-[180px] rounded-full" />
          </CardContent>
        </Card>
        <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-0"><Skeleton className="h-4 w-20" /></CardHeader>
            <CardContent className="pt-3 space-y-3">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-36" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-0"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent className="pt-3 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-0"><Skeleton className="h-4 w-32" /></CardHeader>
            <CardContent className="pt-3"><Skeleton className="h-[120px] w-full rounded-md" /></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { latest, history, isLoading, lastUpdated, deviceState, now } =
    usePolling();

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* State Banners */}
      {deviceState === "OFFLINE" && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 flex items-center gap-3 font-medium">
          <WifiOff className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Device is Offline</p>
            <p className="text-sm font-normal opacity-80">
              No signal received. Please power on the ESP32 and ensure it is
              connected to WiFi.
            </p>
          </div>
        </div>
      )}

      {deviceState === "NOT_WORN" && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg p-4 flex items-center gap-3 font-medium">
          <Hand className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Device Online — Not Being Worn</p>
            <p className="text-sm font-normal opacity-80">
              The device is powered on and connected to WiFi, but the sensors indicate it is not being worn properly. Please wear it on your finger to resume live monitoring.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {deviceState === "LIVE"
              ? "Real-time physiological stress monitoring"
              : "Showing most recent recorded data"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            variant={deviceState === "LIVE" ? "default" : "secondary"} 
            className={`gap-1.5 font-normal ${
              deviceState === "OFFLINE" ? "bg-muted text-muted-foreground" : 
              deviceState === "NOT_WORN" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : 
              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {deviceState === "LIVE" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                deviceState === "OFFLINE" ? "bg-muted-foreground" : 
                deviceState === "NOT_WORN" ? "bg-amber-500" : 
                "bg-emerald-500"
              }`} />
            </span>
            {deviceState === "LIVE" ? "Live" : deviceState === "NOT_WORN" ? "Not Worn" : "Offline"}
          </Badge>
          <LastUpdatedBadge lastUpdated={lastUpdated} isLoading={isLoading} />
        </div>
      </div>

      {/* Primary metrics row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-1 lg:col-span-1">
          <StressGauge
            score={latest?.hybridScore ?? null}
            category={latest?.category ?? null}
            isLive={deviceState === "LIVE"}
          />
        </div>
        <div className="md:col-span-1 lg:col-span-2">
          <HeartRateCard
            heartRate={latest?.heartRate ?? null}
            isLive={deviceState === "LIVE"}
            history={history
              .map((p) => p.heartRate)
              .filter((v): v is number => v !== null)}
          />
        </div>
      </div>

      {/* Signal trend charts */}
      <div className="grid gap-4 md:grid-cols-3">
        <SignalChart
          title="Heart Rate"
          unit="BPM"
          color="hsl(var(--chart-1))"
          now={now}
          isLive={deviceState === "LIVE"}
          data={history
            .filter((p) => p.heartRate !== null)
            .map((p) => ({
              value: p.heartRate as number,
              timestamp: p.createdAt,
            }))
            .reverse()}
        />
        <SignalChart
          title="GSR / Skin Conductance"
          unit="μS"
          color="hsl(var(--chart-2))"
          now={now}
          isLive={deviceState === "LIVE"}
          data={history
            .filter((p) => p.gsrLevel !== null)
            .map((p) => ({
              value: p.gsrLevel as number,
              timestamp: p.createdAt,
            }))
            .reverse()}
        />
        <SignalChart
          title="Skin Temperature"
          unit="°C"
          color="hsl(var(--chart-3))"
          now={now}
          isLive={deviceState === "LIVE"}
          data={history
            .filter((p) => p.temperature !== null)
            .map((p) => ({
              value: p.temperature as number,
              timestamp: p.createdAt,
            }))
            .reverse()}
        />
      </div>
    </div>
  );
}
