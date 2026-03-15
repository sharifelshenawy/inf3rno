import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
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
        <header className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-[#2A2A2A]">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center">
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-[#FF6B2B]">inf</span>
              <span className="text-white">3</span>
              <span className="text-[#FF6B2B]">rno</span>
            </h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
