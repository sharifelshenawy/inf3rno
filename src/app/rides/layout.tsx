import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function RidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    const headerList = await headers();
    const pathname = headerList.get("x-nextjs-path") || headerList.get("x-invoke-path") || "/rides";
    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  // Force onboarding for new users
  const user = session.user as Record<string, unknown>;
  if (!user.onboardingCompleted) {
    const headerList = await headers();
    const pathname = headerList.get("x-nextjs-path") || headerList.get("x-invoke-path") || "/rides";
    redirect(`/onboarding?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  return <>{children}</>;
}
