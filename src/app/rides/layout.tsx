import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/rides");
  }
  return <>{children}</>;
}
