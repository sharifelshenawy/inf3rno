import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Server-side auth guard. Call at the top of protected page server components
 * or in generateMetadata. Redirects to /login if not authenticated.
 * Returns the session if authenticated.
 */
export async function requireAuth(callbackUrl?: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`);
  }

  // Redirect to onboarding if not completed
  const user = session.user as Record<string, unknown>;
  if (!user.onboardingCompleted && callbackUrl !== "/onboarding") {
    redirect("/onboarding");
  }

  return session;
}
