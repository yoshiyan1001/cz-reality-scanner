import type { Filters } from "./settings";
import { hostSite } from "./sites";
import { AREA, PRICE, findAddress, findLayout, fold, parsePrice, slug, spacedText } from "./text";
import type { Alternative, FlatInfo, Source } from "./types";

export type SearchTarget = {
  source: Source;
  url: string;
  /** Tried when `url` returns 404 (e.g. an unknown neighborhood slug). */
  fallbackUrl?: string;
};

/**
 * Search-result page URLs per competitor, with the user's filters applied server-side so a
 * single page holds as many matches as possible. Only built from validated fields.
 */
export function searchUrls(flat: FlatInfo, { range, furnishedOnly }: Filters): SearchTarget[] {
  const bezrealitkyQuery = new URLSearchParams({ disposition: `DISP_${flat.layout.replace("+", "_").toUpperCase()}` });
  if (range.min != null) bezrealitkyQuery.set("priceFrom", String(range.min));
  if (range.max != null) bezrealitkyQuery.set("priceTo", String(range.max));
  if (furnishedOnly) bezrealitkyQuery.set("equipped", "VYBAVENY");
  const bezrealitky = `https://www.bezrealitky.cz/vypis/nabidka-${flat.offerType}/byt`;

  const idnesQuery = new URLSearchParams();
  if (range.min != null) idnesQuery.set("s-qc[priceMin]", String(range.min));
  if (range.max != null) idnesQuery.set("s-qc[priceMax]", String(range.max));
  if (furnishedOnly) idnesQuery.set("vybaveni", "zarizeny");
  const idnesArea = flat.district ? slug(flat.district) : "praha"; // praha-2
  const idnesSearch = idnesQuery.size ? `?${idnesQuery}` : "";

  const district = flat.district ? slug(flat.district) : null; // praha-2
  const expatsSubtype = expatsLayout(flat.layout);

  const targets: (SearchTarget | null)[] = [
    {
      source: "bezrealitky",
      // Bezrealitky filters by neighborhood: /byt/praha-vinohrady
      url: flat.neighborhood
        ? `${bezrealitky}/praha-${slug(flat.neighborhood)}?${bezrealitkyQuery}`
        : `${bezrealitky}/praha?${bezrealitkyQuery}`,
      fallbackUrl: flat.neighborhood ? `${bezrealitky}/praha?${bezrealitkyQuery}` : undefined,
    },
    {
      source: "idnes",
      url: `https://reality.idnes.cz/s/${flat.offerType}/byty/${flat.layout}/${idnesArea}/${idnesSearch}`,
    },
    {
      source: "realitymix",
      url: `https://realitymix.cz/reality/byty/${flat.layout}/${flat.offerType}/praha${district ? `/${district}` : ""}`,
      fallbackUrl: district ? `https://realitymix.cz/reality/byty/${flat.layout}/${flat.offerType}/praha` : undefined,
    },
    {
      source: "videobydleni",
      url: `https://www.videobydleni.cz/${flat.offerType}/byty/${flat.layout}/praha`,
    },
    {
      // RE/MAX has no layout filter in the URL; listings are filtered by layout after parsing.
      source: "remax",
      url: `https://www.remax-czech.cz/reality/byty/${flat.offerType}/praha/${district ? `${district}/` : ""}`,
      fallbackUrl: district ? `https://www.remax-czech.cz/reality/byty/${flat.offerType}/praha/` : undefined,
    },
    expatsSubtype
      ? {
          source: "expats",
          url: `https://www.expats.cz/praguerealestate/apartments/for-${flat.offerType === "pronajem" ? "rent" : "sale"}?re_advert_subtype=${expatsSubtype}`,
        }
      : null,
  ];

  // No point suggesting listings from the site you're already on.
  const own = hostSite(flat.siteHost)?.source;
  return targets.filter((t): t is SearchTarget => !!t && t.source !== own);
}

/** Expats.cz layout slugs: "2+kk" -> "2-plus-kk-1-bedroom", "1+1" -> "1-plus-1-studio". */
function expatsLayout(layout: string): string | null {
  const m = layout.match(/^(\d)\+(kk|1)$/);
  if (!m) return null;
  const rooms = Number(m[1]);
  if (rooms === 1) return `1-plus-${m[2]}-studio`;
  if (rooms > 5) return "5-bedrooms-and-more";
  const bedrooms = rooms - 1;
  return `${rooms}-plus-${m[2]}-${bedrooms}-bedroom${bedrooms === 1 ? "" : "s"}`;
}

// Bezrealitky is a Next.js app: listings live in the embedded Apollo cache.
type BezrealitkyAdvert = {
  __typename?: string;
  uri?: string;
  offerType?: string;
  disposition?: string;
  price?: number;
  charges?: number | null;
  surface?: number | null;
  [key: string]: unknown;
};

/** Read a field whose cache key carries arguments, e.g. `address({"locale":"CS"})`. */
function field(a: BezrealitkyAdvert, name: string): unknown {
  const key = Object.keys(a).find((k) => k === name || k.startsWith(`${name}(`));
  return key ? a[key] : undefined;
}

function bezrealitkyFurnished(tags: unknown): boolean | null {
  if (!Array.isArray(tags)) return null;
  if (tags.includes("Vybaveno")) return true;
  if (tags.includes("Částečně vybaveno") || tags.includes("Nevybaveno")) return false;
  return null;
}

export function parseBezrealitky(doc: Document, flat: FlatInfo): Alternative[] {
  const raw = doc.getElementById("__NEXT_DATA__")?.textContent;
  if (!raw) return [];

  let cache: Record<string, BezrealitkyAdvert>;
  try {
    cache = JSON.parse(raw)?.props?.pageProps?.apolloCache ?? {};
  } catch {
    return [];
  }

  const wanted = `DISP_${flat.layout.replace("+", "_").toUpperCase()}`;

  return Object.values(cache)
    .filter(
      (a) =>
        a.__typename === "Advert" &&
        a.disposition === wanted &&
        a.offerType === flat.offerType.toUpperCase() &&
        typeof a.price === "number" &&
        typeof a.uri === "string" &&
        /^[\w-]+$/.test(a.uri),
    )
    .map((a) => {
      const address = field(a, "address");
      return {
        source: "bezrealitky" as const,
        url: `https://www.bezrealitky.cz/nemovitosti-byty-domy/${a.uri}`,
        title: `${flat.layout}${a.surface ? `, ${a.surface} m²` : ""}`,
        priceCzk: a.price!,
        chargesCzk: typeof a.charges === "number" && a.charges > 0 ? a.charges : null,
        areaM2: a.surface ?? null,
        address: typeof address === "string" ? address : "Praha",
        noCommission: true, // Bezrealitky only lists direct-from-owner offers.
        furnished: bezrealitkyFurnished(field(a, "tags")),
      };
    });
}

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

/**
 * iDNES result cards don't show furnishing, so when the search URL asked for furnished
 * flats only, trust the site's filter.
 */
export function parseIdnes(doc: Document, furnishedFilterApplied: boolean): Alternative[] {
  const links = doc.querySelectorAll<HTMLAnchorElement>('a.c-products__link[href^="https://reality.idnes.cz/detail/"]');

  return Array.from(links).flatMap((a) => {
    const price = Number(text(a.querySelector(".c-products__price")).replace(/Kč.*$/, "").replace(/\D/g, ""));
    // Some agencies post placeholder prices (e.g. "28 Kč"); skip anything implausible.
    if (!Number.isFinite(price) || price < 1000) return [];
    const title = text(a.querySelector(".c-products__title"));
    const area = title.match(/(\d{2,4})\s*m²/);
    return [
      {
        source: "idnes" as const,
        url: a.href,
        title: title.replace(/^(pronájem|prodej)\s+(bytu\s+)?/i, ""),
        priceCzk: price,
        chargesCzk: null,
        areaM2: area ? Number(area[1]) : null,
        address: text(a.querySelector(".c-products__info")),
        noCommission: false,
        furnished: furnishedFilterApplied ? true : null,
      },
    ];
  });
}

// --- Generic result-card parser --------------------------------------------------------
// RealityMIX, Videobydleni, RE/MAX and Expats.cz render plain HTML cards whose text follows
// the same Czech conventions ("Pronájem bytu 2+kk, 54 m², Korunní, Praha 2 - Vinohrady",
// "25 000 Kč"), so one parser reads them all.

type CardSite = { source: Source; base: string; href: RegExp };

const CARD_SITES: CardSite[] = [
  { source: "realitymix", base: "https://realitymix.cz", href: /^https:\/\/realitymix\.cz\/detail\// },
  { source: "videobydleni", base: "https://www.videobydleni.cz", href: /^\/detail\/\d+\// },
  { source: "remax", base: "https://www.remax-czech.cz", href: /^\/reality\/detail\/\d+\// },
  { source: "expats", base: "https://www.expats.cz", href: /^\/praguerealestate\/for-(rent|sale)\/apartments\/\d+/ },
];

const NO_COMMISSION = /bez provize|nehradíte provizi|private offer|přímo od majitele|bez RK\b/i;

function cardFurnished(text: string): boolean | null {
  if (/nevybaven|nezařízen|unfurnished/i.test(text)) return false;
  if (/(?<!částečně )(vybaven|zařízen)|\bfurnished/i.test(text)) return true;
  return null;
}

function parseCards(doc: Document, site: CardSite, flat: FlatInfo): Alternative[] {
  const listingUrl = (a: Element) => {
    const href = a.getAttribute("href");
    return href && site.href.test(href) ? new URL(href, site.base).href.split(/[?#]/)[0] : null;
  };

  // One anchor per listing (cards repeat the link on the photo, title and button).
  const anchors = new Map<string, Element>();
  for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
    const url = listingUrl(a);
    if (url && !anchors.has(url)) anchors.set(url, a);
  }

  /** Smallest ancestor that has a price and contains this listing only. */
  const cardOf = (a: Element): Element | null => {
    let el: Element | null = a;
    for (let depth = 0; el && depth < 8; depth++, el = el.parentElement) {
      const urls = new Set(Array.from(el.querySelectorAll("a[href]"), listingUrl).filter(Boolean));
      if (urls.size > 1) return null;
      if (PRICE.test(spacedText(el))) return el;
    }
    return null;
  };

  return [...anchors].flatMap(([url, a]) => {
    const card = cardOf(a);
    if (!card) return [];
    const text = spacedText(card);
    const heading = card.querySelector("h1, h2, h3, h4, h5, [class*='title' i]");
    const title = (heading ? spacedText(heading) : a.getAttribute("title") ?? "").trim();

    const layout = findLayout(title) ?? findLayout(url);
    const price = parsePrice(text);
    // Skip other layouts (RE/MAX can't filter by layout) and placeholder prices.
    if (layout !== flat.layout || price == null || price < 1000) return [];
    const area = text.match(AREA);

    return [
      {
        source: site.source,
        url,
        title: area ? `${layout}, ${area[1]} m²` : layout,
        priceCzk: price,
        chargesCzk: null,
        areaM2: area ? Number(area[1]) : null,
        address: findAddress(text) ?? findAddress(title) ?? "Praha",
        noCommission: NO_COMMISSION.test(text),
        furnished: cardFurnished(text),
      },
    ];
  });
}

/** Parse one fetched search page into listings. */
export function parsePage(source: Source, doc: Document, flat: FlatInfo, filters: Filters): Alternative[] {
  if (source === "bezrealitky") return parseBezrealitky(doc, flat);
  if (source === "idnes") return parseIdnes(doc, filters.furnishedOnly);
  const site = CARD_SITES.find((s) => s.source === source);
  return site ? parseCards(doc, site, flat) : [];
}

/** "Korunní, Praha 2 - Vinohrady" -> "korunni"; null when the address has no street. */
const streetOf = (address: string) => {
  const first = address.split(",")[0].trim();
  return /^(praha|prague)\b/i.test(first) ? null : fold(first);
};

/** Same street and size within 1 m²; when a listing omits its street, demand the exact size. */
function sameSizeAndStreet(a: Alternative, b: Alternative): boolean {
  const streetA = streetOf(a.address);
  const streetB = streetOf(b.address);
  if (streetA && streetB) {
    return streetA === streetB && (a.areaM2 == null || b.areaM2 == null || Math.abs(a.areaM2 - b.areaM2) <= 1);
  }
  return a.areaM2 != null && a.areaM2 === b.areaM2;
}

/**
 * Agencies post the same flat on several portals. Merge listings with the same price, size
 * and street into one result that links to every site — preferring a no-commission
 * listing as the main one.
 */
function groupSameFlat(listings: Alternative[]): Alternative[] {
  const groups: Alternative[] = [];
  for (const listing of listings) {
    const match = groups.find(
      (g) =>
        g.priceCzk === listing.priceCzk &&
        g.source !== listing.source &&
        !g.alsoOn?.some((o) => o.source === listing.source) &&
        sameSizeAndStreet(g, listing),
    );
    if (!match) {
      groups.push({ ...listing, alsoOn: [] });
      continue;
    }
    const entry = { source: listing.source, url: listing.url };
    if (listing.noCommission && !match.noCommission) {
      // Promote the no-commission listing to be the main link.
      const previous = { source: match.source, url: match.url };
      Object.assign(match, { ...listing, alsoOn: [...(match.alsoOn ?? []), previous] });
    } else {
      match.alsoOn!.push(entry);
    }
  }
  return groups;
}

/** How far price and size may differ from the viewed flat to still count as similar. */
const PRICE_TOLERANCE = 0.3;
const AREA_TOLERANCE = 0.25;
/** Ranking penalty for being in the same district but a different neighborhood. */
const OTHER_NEIGHBORHOOD_PENALTY = 0.15;

const relativeDiff = (a: number, b: number) => Math.abs(a - b) / b;

/**
 * Up to `limit` flats similar to the viewed one — same layout, same neighborhood or district,
 * similar size, and a price within ±30% (or within the user's own range, when set) — most
 * similar first, with the same flat on several sites merged into one result.
 */
export function findSimilar(all: Alternative[], flat: FlatInfo, filters: Filters, limit = 20): Alternative[] {
  const { range, furnishedOnly } = filters;
  const sameNeighborhood = (a: Alternative) => !!flat.neighborhood && fold(a.address).includes(fold(flat.neighborhood));
  const sameDistrict = (a: Alternative) => !!flat.district && fold(a.address).includes(fold(flat.district));

  const priceOk = (a: Alternative) => {
    if (range.min != null || range.max != null) {
      return (range.min == null || a.priceCzk >= range.min) && (range.max == null || a.priceCzk <= range.max);
    }
    return flat.priceCzk == null || relativeDiff(a.priceCzk, flat.priceCzk) <= PRICE_TOLERANCE;
  };
  const areaOk = (a: Alternative) =>
    a.areaM2 == null || flat.areaM2 == null || relativeDiff(a.areaM2, flat.areaM2) <= AREA_TOLERANCE;

  // Lower is more similar.
  const score = (a: Alternative) =>
    (flat.priceCzk ? relativeDiff(a.priceCzk, flat.priceCzk) : 0) +
    (a.areaM2 != null && flat.areaM2 ? relativeDiff(a.areaM2, flat.areaM2) : 0) +
    (sameNeighborhood(a) ? 0 : OTHER_NEIGHBORHOOD_PENALTY);

  const candidates = [...new Map(all.map((a) => [a.url, a])).values()]
    .filter(
      (a) =>
        a.url !== flat.url &&
        (sameNeighborhood(a) || sameDistrict(a)) &&
        priceOk(a) &&
        areaOk(a) &&
        (!furnishedOnly || a.furnished === true),
    )
    .sort((a, b) => score(a) - score(b));

  return groupSameFlat(candidates).slice(0, limit);
}
