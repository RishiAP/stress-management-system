import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Activity, Brain, Shield, Zap } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function LandingPage() {
  const { userId } = await auth();
  
  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Background gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[1000px] h-[1000px] rounded-full bg-primary/20 blur-[120px] mix-blend-screen opacity-50 animate-pulse" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-emerald-500/20 blur-[120px] mix-blend-screen opacity-50" />
      </div>

      <header className="relative z-10 px-6 lg:px-14 h-20 flex items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">NeuroSync</span>
        </div>
        <nav className="flex items-center gap-4">
          {!userId ? (
            <>
              <Link href="/sign-in">
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button className="rounded-full shadow-lg hover:shadow-xl transition-all">Get Started</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/dashboard">
                <Button className="rounded-full shadow-lg hover:shadow-xl transition-all">Go to Dashboard</Button>
              </Link>
              <UserButton />
            </>
          )}
        </nav>
      </header>

      <main className="flex-1 relative z-10">
        <section className="w-full py-24 md:py-32 lg:py-48 flex items-center justify-center">
          <div className="container px-4 md:px-6 flex flex-col items-center text-center gap-8">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Zap className="mr-1 h-3.5 w-3.5" />
              Next-Gen Physiological Monitoring
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter max-w-4xl bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60 drop-shadow-sm">
              Real-time stress analysis at your fingertips.
            </h1>
            
            <p className="max-w-[700px] text-lg md:text-xl text-muted-foreground">
              NeuroSync seamlessly integrates with ESP32 wearables to stream biometric data, leveraging advanced ML to provide accurate, real-time stress insights.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              {!userId ? (
                <Link href="/sign-up">
                  <Button size="lg" className="rounded-full px-8 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full sm:w-auto h-14 text-base">
                    Start Monitoring Now
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <Button size="lg" className="rounded-full px-8 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full sm:w-auto h-14 text-base">
                    Open Dashboard
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="w-full py-20 bg-muted/30 border-t border-border/40">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-12 md:grid-cols-3">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-background rounded-2xl shadow-sm border border-border/50">
                  <Activity className="h-8 w-8 text-rose-500" />
                </div>
                <h3 className="text-xl font-bold">Biometric Telemetry</h3>
                <p className="text-muted-foreground">Streams live BVP, GSR, and skin temperature directly from custom wearable devices.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-background rounded-2xl shadow-sm border border-border/50">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">ML Prediction</h3>
                <p className="text-muted-foreground">Uses RandomForest models trained on physiological datasets to predict cognitive stress states.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-background rounded-2xl shadow-sm border border-border/50">
                  <Shield className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold">Hybrid Scoring</h3>
                <p className="text-muted-foreground">Combines real-time physiology with psychological baseline assessments for a personalized score.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
