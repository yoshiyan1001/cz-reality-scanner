import { PRAGUE_NEIGHBORHOODS } from "./prague-neighborhoods";

// Shared text parsing for listing pages in Czech, English, or Chrome-translated text.

// "30 000 Kč", "7,120,000 CZK", "25.000 Kč"
export const PRICE = /(\d{1,3}(?:[\s  ,.]\d{3})+|\d{4,})\s*(?:Kč|CZK)/;
// "2+kk", "2 + 1", "2-kk", "2-plus-kk", "2kk" (URLs and titles)
const LAYOUT_ANY = /\b(\d)\s*(?:\+|-plus-|-)?\s*(kk|\d)\b/i;
// "Korunní, Praha 2 - Vinohrady" / "Bohumínská, Prague - Letňany" / "Praha - Letňany, Kostomlatská"
// / "Na Havránce, Praha 12, Modřany" (RealityMIX)
export const LOCALITY = /(?:Praha|Prague)(?:\s*(\d{1,2}))?(?:\s*[-–,]\s*([\p{L}][\p{L} .]*[\p{L}]))?/u;
const ADDRESS = /(?:[\p{L}][\p{L}\d .]{1,40},\s*)?(?:Praha|Prague)(?:\s*\d{1,2})?(?:\s*[-–,]\s*[\p{L}][\p{L} .]*[\p{L}])?/gu;
// Card text that sits right before the address: "2+kk, ", "m 2 " (from m<sup>2</sup>).
const ADDRESS_PREFIX_NOISE = /^(?:\d\s*\+\s*(?:kk|\d)|kk|m\s*2|m²)\b[\s,]*/i;
export const AREA = /(\d{2,4})\s*m\s*(?:²|2\b)/;

// Zero-width characters some portals put inside numbers ("35&zwj;&nbsp;000 Kč" on iDNES).
const INVISIBLE = /[\u200b-\u200d\u2060\ufeff]/g;

export function parsePrice(text: string | null | undefined): number | null {
  const m = text?.replace(INVISIBLE, "").match(PRICE);
  return m ? Number(m[1].replace(/\D/g, "")) : null;
}

/** Find a flat layout in a title or URL and normalize it to "2+kk" / "3+1". */
export function findLayout(text: string): string | null {
  const m = text.match(LAYOUT_ANY);
  return m ? `${m[1]}+${m[2].toLowerCase()}` : null;
}

/** The most specific "Street, Praha N - Neighborhood" in the text (cards also mention bare "Praha"). */
export function findAddress(text: string): string | null {
  const matches = Array.from(text.matchAll(ADDRESS), (m) => m[0].trim().replace(ADDRESS_PREFIX_NOISE, ""));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const BY_LENGTH = [...PRAGUE_NEIGHBORHOODS].sort((a, b) => b.length - a.length);

/** The neighborhood named in a URL slug ("praha-nove-mesto-vodickova" -> "Nové Město"). */
export function neighborhoodFromSlug(text: string): string | null {
  const s = `-${slug(text)}-`;
  return BY_LENGTH.find((n) => s.includes(`-praha-${slug(n)}-`) || s.includes(`-prague-${slug(n)}-`)) ?? null;
}

/**
 * The neighborhood named after "Praha" in visible text. Prefers a known Prague area, also
 * inside odd formats like Bezrealitky's "Praha - Praha-Praha-Vinohrady".
 */
export function neighborhoodFromText(text: string): string | null {
  const match = text.match(LOCALITY);
  if (!match) return null;
  const named = match[2]?.trim();
  if (named) {
    const known = BY_LENGTH.find((n) => fold(named).startsWith(fold(n)));
    if (known) return known;
  }
  const after = fold(text.slice(match.index!, match.index! + 80));
  const inAddress = BY_LENGTH.find((n) => new RegExp(`(^|[^a-z])${fold(n)}([^a-z]|$)`).test(after));
  if (inAddress) return inAddress;
  return named && !/^(praha|prague)$/i.test(named) ? named : null;
}

/** Text of a node with a space between child nodes, so "Praha 9" + "7 120 000 Kč" don't merge. */
export function spacedText(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? "").replace(INVISIBLE, "");
  if (node.nodeType !== 1) return "";
  const tag = (node as Element).tagName;
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return "";
  return Array.from(node.childNodes, spacedText).join(" ").replace(INVISIBLE, "").replace(/\s+/g, " ");
}
