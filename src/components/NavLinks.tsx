"use client";

import {
  generateGoogleMapsUrl,
  generateWazeUrl,
  generateAppleMapsUrl,
} from "@/lib/navLinks";
import { trackEvent } from "@/lib/analytics";

interface LatLng {
  lat: number;
  lng: number;
}

interface NavLinksProps {
  meetingPoint: LatLng;
  waypoints: LatLng[];
  destination: LatLng;
}

export default function NavLinks({
  meetingPoint,
  waypoints,
  destination,
}: NavLinksProps) {
  const googleUrl = generateGoogleMapsUrl(meetingPoint, waypoints, destination);
  const wazeUrl = generateWazeUrl(meetingPoint, waypoints, destination);
  const appleUrl = generateAppleMapsUrl(meetingPoint, waypoints, destination);

  const links = [
    { label: "Google Maps", url: googleUrl, icon: "\u{1F5FA}\uFE0F" },
    { label: "Waze", url: wazeUrl, icon: "\u{1F698}" },
    { label: "Apple Maps", url: appleUrl, icon: "\u{1F34E}" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
        Open in
      </p>
      <div className="grid grid-cols-3 gap-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("nav_link_clicked", { app: link.label })}
            className="flex flex-col items-center gap-1 p-3 rounded-lg bg-[#141414] border border-[#2A2A2A] hover:border-[#FF6B2B] transition-colors text-center"
          >
            <span className="text-xl">{link.icon}</span>
            <span className="text-xs text-zinc-400 font-medium">
              {link.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
