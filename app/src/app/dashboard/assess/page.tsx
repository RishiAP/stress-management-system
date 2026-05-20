import type { Metadata } from "next";
import { Dass21Form } from "@/components/assess/dass21-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Baseline Assessment — Stress Management",
  description: "Complete the psychological questionnaire to improve your hybrid stress score accuracy",
};

export default function AssessPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Baseline Assessment
        </h1>
        <p className="text-sm text-muted-foreground">
          A 21-question psychological survey to establish your baseline stress levels
        </p>
      </div>

      <Separator />

      {/* Info card */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How this affects your readings</CardTitle>
          <CardDescription>
            Your answers calibrate the system&apos;s stress sensitivity — they add up to
            a <strong>±20%</strong> modifier on top of the physiological ML score. The
            sensor data always remains the primary signal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Rate each statement below based on how often it applied to you{" "}
            <strong>over the past week</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Assessment form */}
      <Dass21Form />
    </div>
  );
}
