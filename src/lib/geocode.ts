export interface GeocodedLocation {
  lat: number;
  lng: number;
  displayName: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestTime = 0;

export async function geocodeSuburb(
  query: string
): Promise<GeocodedLocation | null> {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1100) {
    await delay(1100 - timeSinceLast);
  }
  lastRequestTime = Date.now();

  try {
    const encoded = encodeURIComponent(`${query} Victoria Australia`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "inf3rno/1.0",
        },
      }
    );

    const data = await response.json();
    if (!data || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name.split(",")[0],
    };
  } catch {
    return null;
  }
}
