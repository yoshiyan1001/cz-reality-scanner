export type OfferType = "pronajem" | "prodej";

/** The flat currently open in the tab. */
export type FlatInfo = {
  /** Hostname of the site being browsed, e.g. "www.sreality.cz". */
  siteHost: string;
  /** The listing's own URL, so it's never suggested as similar to itself. */
  url: string;
  offerType: OfferType;
  /** Czech layout notation, e.g. "2+kk". */
  layout: string;
  /** From the listing URL slug ("praha-…"); v1 only compares Prague flats. */
  inPrague: boolean;
  priceCzk: number | null;
  areaM2: number | null;
  /** "Praha 2" */
  district: string | null;
  /** "Vinohrady" */
  neighborhood: string | null;
};

export type Source = "bezrealitky" | "idnes" | "realitymix" | "videobydleni" | "remax" | "expats";

export type FindAlternativesRequest = { type: "FIND_ALTERNATIVES"; flat: FlatInfo };

/** Content scripts can't open the options page themselves, so they ask the background worker. */
export type OpenSettingsRequest = { type: "OPEN_SETTINGS" };

export type FetchedPage = { source: Source; url: string; html: string };

export type FindAlternativesResponse =
  | { ok: true; pages: FetchedPage[]; failed: Source[] }
  | { ok: false; error: string };

export type Alternative = {
  source: Source;
  url: string;
  title: string;
  priceCzk: number;
  /** Monthly charges listed separately from rent (Bezrealitky shows these). */
  chargesCzk: number | null;
  areaM2: number | null;
  address: string;
  /** Listed directly by the owner, so no agency commission. */
  noCommission: boolean;
  /** Fully furnished (true), partly/unfurnished (false), or not stated (null). */
  furnished: boolean | null;
  /** The listing's first photo, loaded straight from the source site (never stored). */
  imageUrl: string | null;
  /** The same flat advertised on other sites (same price, size and street). */
  alsoOn?: { source: Source; url: string }[];
};
