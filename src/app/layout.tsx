import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "inf3rno — Motorcycle Ride Planner",
  description:
    "Plan group motorcycle rides across Melbourne. Find meeting points, match routes, and ride together.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "inf3rno",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF6B2B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased`}>
        <Providers>
          <Header />
          <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
