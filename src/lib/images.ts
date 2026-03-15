/**
 * Fetch images from Wikimedia Commons using the combined generator=search approach.
 * Single API call — free, no key, CORS-friendly.
 */
export interface RouteImage {
  title: string;
  url: string;
  thumbUrl: string;
  attribution: string;
  license: string;
  descriptionUrl: string;
}

export async function fetchRouteImages(
  query: string,
  limit: number = 6
): Promise<RouteImage[]> {
  try {
    // Combined search + image info in one call
    const url =
      `https://commons.wikimedia.org/w/api.php?` +
      `action=query` +
      `&generator=search` +
      `&gsrsearch=${encodeURIComponent(query)}` +
      `&gsrnamespace=6` +
      `&gsrlimit=${limit}` +
      `&prop=imageinfo` +
      `&iiprop=url|mime|extmetadata` +
      `&iiurlwidth=800` +
      `&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription` +
      `&format=json` +
      `&origin=*`;

    const res = await fetch(url, {
      headers: { "Api-User-Agent": "inf3rno/1.0 (motorcycle ride planner)" },
    });
    if (!res.ok) return [];
    const data = await res.json();

    const pages = data.query?.pages || {};
    const images: RouteImage[] = [];

    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const info = page.imageinfo?.[0];
      if (!info) continue;

      // Skip non-images (PDFs, SVGs, etc.)
      if (!info.mime?.startsWith("image/jpeg") && !info.mime?.startsWith("image/png")) {
        continue;
      }

      const meta = info.extmetadata || {};
      const artist =
        meta.Artist?.value?.replace(/<[^>]*>/g, "").trim() || "Unknown";
      const license = meta.LicenseShortName?.value || "CC BY-SA";

      images.push({
        title: page.title.replace("File:", "").replace(/\.\w+$/, ""),
        url: info.url,
        thumbUrl: info.thumburl || info.url,
        attribution: artist,
        license,
        descriptionUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      });
    }

    return images;
  } catch {
    return [];
  }
}

/**
 * Search queries for each route — tuned for good Wikimedia Commons results.
 */
export const ROUTE_IMAGE_QUERIES: Record<string, string> = {
  "reefton-spur": "Reefton Spur Victoria Australia road",
  "black-spur": "Black Spur Drive Victoria mountain ash",
  "donna-buang": "Mount Donna Buang Victoria",
  "great-ocean-road-torquay": "Great Ocean Road Victoria coast",
  "lorne-deans-marsh": "Lorne Victoria Australia",
  "skenes-creek-otways": "Otway Ranges Victoria forest",
  "kinglake-loop": "Kinglake National Park Victoria",
  "dandenong-ranges": "Dandenong Ranges Victoria",
  "mornington-loop": "Mornington Peninsula Victoria coast",
  "yarra-valley-loop": "Yarra Valley Victoria landscape",
  "yarra-glen-loop": "Yarra Glen Victoria vineyard",
  "mt-baw-baw": "Mount Baw Baw Victoria alpine",
  "lerderderg-gorge": "Lerderderg Gorge Victoria",
  "blackwood-trentham-loop": "Trentham Falls Victoria",
  "great-alpine-road": "Mount Hotham Victoria alpine road",
  "south-gippsland-cruise": "Wilsons Promontory Victoria",
};
