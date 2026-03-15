import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "inf3rno — Motorcycle Ride Planner",
    short_name: "inf3rno",
    description: "Plan group motorcycle rides across Melbourne",
    theme_color: "#FF6B2B",
    background_color: "#0A0A0A",
    display: "standalone",
    orientation: "portrait",
    start_url: "/",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
