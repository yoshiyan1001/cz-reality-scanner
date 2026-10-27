import { hostSite } from "./sites";
import {
  AREA,
  LOCALITY,
  PRICE,
  findLayout,
  neighborhoodFromSlug,
  neighborhoodFromText,
  parsePrice,
  spacedText,
} from "./text";
import type { FlatInfo, OfferType } from "./types";

export function isDetailPage(location: Location): boolean {
  return hostSite(location.hostname)?.isDetail(location.pathname) ?? false;
}

/**
 * The text of the smallest block around the <h1> that also contains a price. On most
 * portals the heading, address and price sit in sibling boxes below a common parent.
 */
function headingBlockText(h1: Element): string {
  let el: Element | null = h1;
  for (let depth = 0; el && depth < 8; depth++, el = el.parentElement) {
    const text = spacedText(el);
    if (PRICE.test(text)) return text;
  }
  return spacedText(h1);
}

function offerTypeOf(text: string): OfferType | null {
  if (/pronajem|pronájem|pronajmu|pronajmem|for-rent|for rent|\bnájem/i.test(text)) return "pronajem";
  if (/prodej|prodam|prodám|for-sale|for sale/i.test(text)) return "prodej";
  return null;
}

/**
 * Read the open listing from any supported site. The URL usually carries offer type,
 * layout and neighborhood (and survives Chrome's page translation); price, area and
 * district come from the visible heading text, in Czech, English or translated form.
 */
export function extractFlat(location: Location, doc: Document): FlatInfo | null {
  if (!isDetailPage(location)) return null;

  const path = decodeURIComponent(location.pathname);
  const h1 = doc.querySelector("h1");
  const h1Text = h1 ? spacedText(h1) : "";
  const pageTitle = [doc.querySelector('meta[property="og:title"]')?.getAttribute("content"), doc.title]
    .filter(Boolean)
    .join(" \n ");
  const block = h1 ? headingBlockText(h1) : "";
  const heading = [block, pageTitle].join(" \n ");

  // Flats only (not houses, plots or offices).
  if (!/\bbyt|\bbytu|apartment|\bflat\b/i.test(`${path} ${h1Text} ${pageTitle}`)) return null;

  const offerType = offerTypeOf(path) ?? offerTypeOf(`${h1Text} ${pageTitle}`);
  const layout = findLayout(h1Text) ?? findLayout(pageTitle) ?? findLayout(path);
  if (!offerType || !layout) return null;

  const locality = heading.match(LOCALITY);
  const area = heading.match(AREA);

  return {
    siteHost: location.hostname,
    url: location.href.split("#")[0],
    offerType,
    layout,
    inPrague: /praha|prague/i.test(`${path} ${heading}`),
    priceCzk: parsePrice(doc.querySelector(".norm-price")?.textContent) ?? parsePrice(block) ?? parsePrice(pageTitle),
    areaM2: area ? Number(area[1]) : null,
    district: locality?.[1] ? `Praha ${locality[1]}` : null,
    neighborhood: neighborhoodFromSlug(path) ?? neighborhoodFromText(heading),
  };
}
