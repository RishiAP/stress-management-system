import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that require Clerk authentication (UI and internal APIs)
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/devices(.*)",
  "/api/assess(.*)",
  "/api/predictions(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect dashboard routes — redirect to sign-in if unauthenticated
  // /api/ingest is NOT protected here — it uses device-token auth
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
