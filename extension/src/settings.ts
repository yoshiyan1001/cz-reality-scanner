import type { OfferType } from "./types";

export type PriceRange = { min: number | null; max: number | null };

export type Settings = {
  /** Show the comparison widget on Sreality at all. */
  enabled: boolean;
  /** Monthly rent range for rentals (CZK). */
  rent: PriceRange;
  /** Purchase price range for sales (CZK). */
  sale: PriceRange;
  furnishedOnly: boolean;
};

/** What the search and filtering need for the flat being viewed. */
export type Filters = { range: PriceRange; furnishedOnly: boolean };

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  rent: { min: null, max: null },
  sale: { min: null, max: null },
  furnishedOnly: false,
};

const KEY = "settings";

function toPrice(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/\D/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function toRange(raw: unknown): PriceRange {
  const r = (raw ?? {}) as Partial<PriceRange>;
  const min = toPrice(r.min);
  const max = toPrice(r.max);
  // Forgive a reversed range rather than silently matching nothing.
  return min != null && max != null && min > max ? { min: max, max: min } : { min, max };
}

/** Storage is user-editable, so never trust its shape. */
export function sanitize(raw: unknown): Settings {
  const s = (raw ?? {}) as Partial<Settings>;
  return {
    enabled: s.enabled !== false,
    rent: toRange(s.rent),
    sale: toRange(s.sale),
    furnishedOnly: s.furnishedOnly === true,
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(KEY);
  return sanitize(stored[KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [KEY]: sanitize(settings) });
}

export function onSettingsChanged(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "sync" && KEY in changes) callback(sanitize(changes[KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export function filtersFor(settings: Settings, offerType: OfferType): Filters {
  return {
    range: offerType === "pronajem" ? settings.rent : settings.sale,
    furnishedOnly: settings.furnishedOnly,
  };
}

export function hasRange({ min, max }: PriceRange): boolean {
  return min != null || max != null;
}
