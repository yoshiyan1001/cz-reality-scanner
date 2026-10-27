"use server";

import { findNearestStations, type MetroLine } from "@/lib/db/spatialSearch";
import { geocodeAll } from "@/lib/web/geocode";
import { searchListingsWeb, type WebListing } from "@/lib/web/searchListingsWeb";
import { parseSearchQuery, type ParsedSearchParams } from "./parseSearchQuery";

/** Average walking speed used to turn minutes into a search radius. */
const WALKING_METERS_PER_MINUTE = 80;
/** Listings this close with the same size are treated as the same flat on different portals. */
const SAME_FLAT_METERS = 40;

export type Offer = Pick<WebListing, "url" | "portal" | "priceCzk" | "agencyFee">;

export type FlatResult = {
  title: string;
  disposition: string | null;
  areaM2: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  nearestStation: { name: string; line: MetroLine; distanceMeters: number; walkMinutes: number } | null;
  /** The same flat as advertised on each portal, cheapest first. */
  offers: Offer[];
};

export type SearchResult =
  | {
      ok: true;
      query: string;
      params: ParsedSearchParams & { maxDistanceMeters: number };
      /** Located flats that pass the metro filter (or all located flats when no line was asked for). */
      flats: FlatResult[];
      /** Flats whose address couldn't be placed on the map, so the metro filter can't be checked. */
      unlocated: FlatResult[];
      searchSuggestionsHtml: string | null;
    }
  | { ok: false; query: string; error: string };

function distanceMeters(a: FlatResult, b: FlatResult): number {
  // Equirectangular approximation — plenty for "is this the same building?".
  const toRad = Math.PI / 180;
  const x = (b.longitude! - a.longitude!) * toRad * Math.cos(((a.latitude! + b.latitude!) / 2) * toRad);
  const y = (b.latitude! - a.latitude!) * toRad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

function isSameFlat(a: FlatResult, b: FlatResult): boolean {
  if (a.latitude == null || b.latitude == null) return false;
  if (a.disposition && b.disposition && a.disposition !== b.disposition) return false;
  if (a.areaM2 != null && b.areaM2 != null && Math.abs(a.areaM2 - b.areaM2) > 2) return false;
  return distanceMeters(a, b) <= SAME_FLAT_METERS;
}

function byPrice(a: Offer, b: Offer) {
  return (a.priceCzk ?? Infinity) - (b.priceCzk ?? Infinity);
}

/** Merge listings of the same flat from different portals into one result with several offers. */
function groupSameFlats(flats: FlatResult[]): FlatResult[] {
  const groups: FlatResult[] = [];
  for (const flat of flats) {
    const match = groups.find((g) => isSameFlat(g, flat));
    if (match) {
      match.offers.push(...flat.offers.filter((o) => !match.offers.some((m) => m.url === o.url)));
      match.offers.sort(byPrice);
    } else {
      groups.push(flat);
    }
  }
  return groups;
}

export async function searchProperties(query: string): Promise<SearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, query, error: "Please describe what you're looking for." };
  if (trimmed.length > 500) return { ok: false, query, error: "Query is too long." };

  try {
    // The metro filter (Workers AI) and the web search (Gemini + Google Search) are independent.
    const [parsed, web] = await Promise.all([parseSearchQuery(trimmed), searchListingsWeb(trimmed)]);
    const maxDistanceMeters = parsed.maxWalkMinutes * WALKING_METERS_PER_MINUTE;

    const coords = await geocodeAll(web.listings.map((l) => l.address));
    const located = web.listings.flatMap((l, i) => (coords[i] ? [{ ...coords[i]!, index: i }] : []));
    const stations = await findNearestStations(located, parsed.preferredMetroLine);

    const flats: FlatResult[] = web.listings.map((l, i) => ({
      title: l.title,
      disposition: l.disposition,
      areaM2: l.areaM2,
      address: l.address,
      latitude: coords[i]?.latitude ?? null,
      longitude: coords[i]?.longitude ?? null,
      nearestStation: null,
      offers: [{ url: l.url, portal: l.portal, priceCzk: l.priceCzk, agencyFee: l.agencyFee }],
    }));
    located.forEach((p, j) => {
      const s = stations[j];
      flats[p.index].nearestStation = {
        ...s,
        walkMinutes: Math.ceil(s.distanceMeters / WALKING_METERS_PER_MINUTE),
      };
    });

    const grouped = groupSameFlats(flats);
    const matching = grouped
      .filter((f) => f.nearestStation && (!parsed.preferredMetroLine || f.nearestStation.distanceMeters <= maxDistanceMeters))
      .sort((a, b) => a.nearestStation!.distanceMeters - b.nearestStation!.distanceMeters);

    return {
      ok: true,
      query: trimmed,
      params: { ...parsed, maxDistanceMeters },
      flats: matching,
      unlocated: grouped.filter((f) => !f.nearestStation),
      searchSuggestionsHtml: web.searchSuggestionsHtml,
    };
  } catch (error) {
    console.error("searchProperties failed", error);
    return { ok: false, query: trimmed, error: "Search failed. Please try again." };
  }
}

/** Form-action wrapper for useActionState. */
export async function searchPropertiesAction(
  _prev: SearchResult | null,
  formData: FormData,
): Promise<SearchResult> {
  return searchProperties(String(formData.get("q") ?? ""));
}
