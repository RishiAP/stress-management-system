"use client";

import { usePolling } from "@/hooks/use-polling";
import { StressGauge } from "@/components/dashboard/stress-gauge";
import { HeartRateCard } from "@/components/dashboard/heart-rate-card";
import { SignalChart } from "@/components/dashboard/signal-chart";
import { DeviceStatusCard } from "@/components/dashboard/device-status-card";
import { LastUpdatedBadge } from "@/components/dashboard/last-updated-badge";

export default function DashboardPage() {
  const { latest, history, isLoading, lastUpdated } = usePolling();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Live Monitor
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time physiological stress monitoring
          </p>
        </div>
        <LastUpdatedBadge lastUpdated={lastUpdated} isLoading={isLoading} />
      </div>

      {/* Primary metrics row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <StressGauge
            score={latest?.hybridScore ?? null}
            category={latest?.category ?? null}
          />
        </div>
        <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
          <HeartRateCard
            heartRate={latest?.heartRate ?? null}
            history={history
              .map((p) => p.heartRate)
              .filter((v): v is number => v !== null)}
          />
          <DeviceStatusCard
            deviceName={latest?.device?.name ?? null}
            isOnline={latest?.device?.isOnline ?? false}
            lastSeen={latest?.createdAt ?? null}
          />
        </div>
      </div>

      {/* Signal trend charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <SignalChart
          title="GSR / Skin Conductance"
          unit="μS"
          color="hsl(var(--chart-2))"
          data={history
            .filter((p) => p.gsrLevel !== null)
            .map((p) => ({ value: p.gsrLevel as number, timestamp: p.createdAt }))
            .reverse()}
        />
        <SignalChart
          title="Skin Temperature"
          unit="°C"
          color="hsl(var(--chart-3))"
          data={history
            .filter((p) => p.temperature !== null)
            .map((p) => ({ value: p.temperature as number, timestamp: p.createdAt }))
            .reverse()}
        />
      </div>
    </div>
  );
}
