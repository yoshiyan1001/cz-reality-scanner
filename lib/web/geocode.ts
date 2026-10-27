import "server-only";

// Photon (komoot) geocoder over OpenStreetMap data — free, fair-use public API.
// Swap for a keyed geocoder (e.g. Mapy.com) before heavy production traffic.
const PHOTON_URL = "https://photon.komoot.io/api/";
const PRAGUE_BBOX = "14.22,49.94,14.71,50.18"; // minLon,minLat,maxLon,maxLat

export type LatLng = { latitude: number; longitude: number };

export async function geocodePragueAddress(address: string): Promise<LatLng | null> {
  const params = new URLSearchParams({
    q: /praha|prague/i.test(address) ? address : `${address}, Praha`,
    limit: "1",
    lat: "50.08",
    lon: "14.43",
    bbox: PRAGUE_BBOX,
  });

  try {
    const res = await fetch(`${PHOTON_URL}?${params}`, {
      headers: { "User-Agent": "reality-scanner-cz/0.1" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { geometry: { coordinates: [number, number] } }[] };
    const coords = data.features?.[0]?.geometry.coordinates;
    return coords ? { longitude: coords[0], latitude: coords[1] } : null;
  } catch {
    return null;
  }
}

/** Geocode with limited concurrency to stay polite to the public API. */
export async function geocodeAll(addresses: (string | null)[], concurrency = 3): Promise<(LatLng | null)[]> {
  const results: (LatLng | null)[] = new Array(addresses.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < addresses.length) {
      const i = next++;
      const address = addresses[i];
      if (address) results[i] = await geocodePragueAddress(address);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, addresses.length) }, worker));
  return results;
}
