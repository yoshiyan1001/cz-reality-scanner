import { filtersFor, loadSettings } from "./settings";
import { hostSite } from "./sites";
import { searchUrls, type SearchTarget } from "./sources";
import type {
  FetchedPage,
  FindAlternativesRequest,
  FindAlternativesResponse,
  FlatInfo,
  OpenSettingsRequest,
  Source,
} from "./types";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_HTML_BYTES = 3_000_000;

function isValidFlat(flat: unknown): flat is FlatInfo {
  const f = flat as FlatInfo;
  return (
    !!f &&
    (f.offerType === "pronajem" || f.offerType === "prodej") &&
    f.inPrague === true &&
    typeof f.layout === "string" &&
    /^\d\+(kk|\d)$/.test(f.layout) &&
    (f.district === null || /^Praha \d{1,2}$/.test(f.district)) &&
    (f.neighborhood === null || /^[\p{L}][\p{L} .-]{1,40}$/u.test(f.neighborhood))
  );
}

class NotFoundError extends Error {}

/** Fetch a competitor's search page with the user's IP, without their cookies. Cached briefly. */
async function fetchUrl(source: Source, url: string): Promise<FetchedPage> {
  const key = `page:${url}`;
  const cached = (await chrome.storage.session.get(key))[key] as { at: number; html: string } | undefined;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { source, url, html: cached.html };

  const res = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(12_000) });
  if (res.status === 404) throw new NotFoundError(`${source}: 404 ${url}`);
  if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
  const html = await res.text();
  if (html.length > MAX_HTML_BYTES) throw new Error(`${source}: response too large`);

  await chrome.storage.session.set({ [key]: { at: Date.now(), html } }).catch(() => {});
  return { source, url, html };
}

async function fetchTarget({ source, url, fallbackUrl }: SearchTarget): Promise<FetchedPage> {
  try {
    return await fetchUrl(source, url);
  } catch (error) {
    if (error instanceof NotFoundError && fallbackUrl) return fetchUrl(source, fallbackUrl);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message: FindAlternativesRequest | OpenSettingsRequest, sender, sendResponse) => {
  if (message?.type === "OPEN_SETTINGS") {
    if (sender.id === chrome.runtime.id) chrome.runtime.openOptionsPage();
    return false;
  }
  if (message?.type !== "FIND_ALTERNATIVES") return false;

  // Only our own content script on a supported site may trigger fetches, and only for URLs we build.
  const senderHost = sender.url ? new URL(sender.url).hostname : "";
  const fromSupportedSite = sender.id === chrome.runtime.id && !!hostSite(senderHost);
  if (!fromSupportedSite || !isValidFlat(message.flat) || message.flat.siteHost !== senderHost) {
    sendResponse({ ok: false, error: "Invalid request" } satisfies FindAlternativesResponse);
    return false;
  }

  // Filters come from the extension's own storage, never from the page.
  loadSettings()
    .then((settings) => {
      const targets = searchUrls(message.flat, filtersFor(settings, message.flat.offerType));
      return Promise.allSettled(targets.map(fetchTarget)).then((results) => ({ targets, results }));
    })
    .then(({ targets, results }) => {
      const pages = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      const failed = targets.filter((_, i) => results[i].status === "rejected").map((t) => t.source);
      results.forEach((r) => r.status === "rejected" && console.warn("Reality Scanner:", r.reason));
      sendResponse({ ok: true, pages, failed } satisfies FindAlternativesResponse);
    })
    .catch((error: unknown) => sendResponse({ ok: false, error: String(error) } satisfies FindAlternativesResponse));

  return true; // keep the channel open for the async response
});
