import "server-only";

import { createGoogleGenerativeAI, type GoogleProviderMetadata } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { env } from "cloudflare:workers";
import { z } from "zod";

const MODEL = "gemini-3.8-flash";
const MAX_LISTINGS = 12;

export type WebListing = {
  title: string;
  priceCzk: number | null;
  disposition: string | null;
  areaM2: number | null;
  address: string | null;
  agencyFee: "yes" | "no" | "unknown";
  url: string;
  portal: string;
};

export type WebSearchResult = {
  listings: WebListing[];
  /** Google's required "Search Suggestions" widget (HTML), shown with grounded results. */
  searchSuggestionsHtml: string | null;
  searchQueries: string[];
};

const SEARCH_INSTRUCTIONS = `You search the web for apartments currently advertised in Prague, Czech Republic.
Search Czech real estate portals and classifieds (for example sreality.cz, reality.idnes.cz,
ulovdomov.cz, realitymix.cz, realcity.cz, bezrealitky.cz, reality.bazos.cz, expats.cz, remax-czech.cz)
and find individual listings that match the user's request. Assume a rental unless they ask to buy.

For each listing you find, report: a short title, the monthly rent (or price) in CZK, the layout
(Czech notation such as 1+kk or 2+1), floor area in m², the street address and district, the website,
and whether an agency commission applies ("bez provize" / "bez RK" means no commission).
Only report listings you actually found in search results. List up to ${MAX_LISTINGS}.`;

const extractionSchema = z.object({
  listings: z.array(
    z.object({
      sourceIndex: z.number().int().describe("Index of the source the listing came from"),
      title: z.string(),
      priceCzk: z.number().int().nullable().describe("Monthly rent or price in CZK"),
      disposition: z.string().nullable().describe('Czech layout notation, e.g. "2+kk"'),
      areaM2: z.number().nullable(),
      address: z.string().nullable().describe("Street and district, as specific as the listing gives"),
      agencyFee: z.enum(["yes", "no", "unknown"]),
    }),
  ),
});

/** Grounding links are Google redirect URLs; resolve them to the listing's real URL. */
async function resolveSourceUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return res.headers.get("location") ?? url;
  } catch {
    return url;
  }
}

function portalOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export async function searchListingsWeb(query: string): Promise<WebSearchResult> {
  const google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });

  // Step 1: let Gemini search Google.
  const grounded = await generateText({
    model: google(MODEL),
    tools: { google_search: google.tools.googleSearch({}) },
    instructions: SEARCH_INSTRUCTIONS,
    prompt: query,
  });

  const metadata = grounded.providerMetadata?.google as GoogleProviderMetadata | undefined;
  const grounding = metadata?.groundingMetadata;
  const searchSuggestionsHtml = grounding?.searchEntryPoint?.renderedContent ?? null;
  const searchQueries = grounding?.webSearchQueries ?? [];

  const sources = grounded.sources.filter((s) => s.sourceType === "url");
  if (sources.length === 0) return { listings: [], searchSuggestionsHtml, searchQueries };

  const urls = await Promise.all(sources.map((s) => resolveSourceUrl(s.url)));

  // Step 2: turn the grounded answer into structured listings, each tied to a real source.
  const { output } = await generateText({
    model: google(MODEL),
    output: Output.object({ schema: extractionSchema }),
    prompt: `Extract every individual apartment listing from the search report below.
Use the numbered sources to set sourceIndex for each listing (the source it was found on).
Skip anything that is not a specific listing (articles, price statistics, search pages without a flat).

SOURCES:
${sources.map((s, i) => `[${i}] ${s.title ?? ""} ${urls[i]}`).join("\n")}

REPORT:
${grounded.text}`,
  });

  // Drop anything not backed by a real search result.
  const listings = output.listings
    .filter((l) => l.sourceIndex >= 0 && l.sourceIndex < urls.length)
    .slice(0, MAX_LISTINGS)
    .map(({ sourceIndex, ...l }) => ({ ...l, url: urls[sourceIndex], portal: portalOf(urls[sourceIndex]) }));

  return { listings, searchSuggestionsHtml, searchQueries };
}
