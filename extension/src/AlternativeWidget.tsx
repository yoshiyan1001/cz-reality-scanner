import { useEffect, useState } from "react";
import catIcon from "../public/icons/icon-48.png?inline";
import { filtersFor, hasRange, type Filters, type Settings } from "./settings";
import { SOURCE_LABELS } from "./sites";
import { findSimilar, parsePage } from "./sources";
import type {
  Alternative,
  FindAlternativesRequest,
  FindAlternativesResponse,
  FlatInfo,
  OpenSettingsRequest,
  Source,
} from "./types";

function Cat({ className = "h-6 w-6" }: { className?: string }) {
  return <img src={catIcon} alt="" aria-hidden="true" className={`shrink-0 ${className}`} />;
}

/** Shown straight away; the rest sit behind "Show more". */
const TOP_COUNT = 3;

const openSettings = () => chrome.runtime.sendMessage<OpenSettingsRequest>({ type: "OPEN_SETTINGS" });

const czk = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });

type State =
  | { status: "loading" }
  | { status: "done"; similar: Alternative[]; failed: Source[] }
  | { status: "error"; message: string };

/** Parse the raw search pages the background worker fetched. DOMParser never runs their scripts. */
function parsePages(
  response: Extract<FindAlternativesResponse, { ok: true }>,
  flat: FlatInfo,
  filters: Filters,
): Alternative[] {
  const parser = new DOMParser();
  return response.pages.flatMap((page) => {
    const doc = parser.parseFromString(page.html, "text/html");
    return parsePage(page.source, doc, flat, filters);
  });
}

/** "20 000 – 25 000 Kč · furnished", or null when no filters are set. */
function describeFilters({ range, furnishedOnly }: Filters): string | null {
  const parts: string[] = [];
  if (hasRange(range)) {
    const fmt = (n: number) => czk.format(n);
    parts.push(
      range.min != null && range.max != null
        ? `${fmt(range.min)} – ${fmt(range.max)}`
        : range.min != null
          ? `from ${fmt(range.min)}`
          : `up to ${fmt(range.max!)}`,
    );
  }
  if (furnishedOnly) parts.push("furnished");
  return parts.length ? parts.join(" · ") : null;
}

/** "−3 000 Kč" (cheaper, green) / "+2 000 Kč" / "same price", relative to the viewed flat. */
function PriceDiff({ price, reference }: { price: number; reference: number | null }) {
  if (reference == null) return null;
  const diff = price - reference;
  if (diff === 0) return <span className="block text-xs text-zinc-500">same price</span>;
  return (
    <span className={`block text-xs font-medium ${diff < 0 ? "text-emerald-700" : "text-zinc-500"}`}>
      {diff < 0 ? "−" : "+"}
      {czk.format(Math.abs(diff))}
    </span>
  );
}

export function AlternativeWidget({ flat, settings }: { flat: FlatInfo; settings: Settings }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const unit = flat.offerType === "pronajem" ? "/month" : "";
  const filters = filtersFor(settings, flat.offerType);

  useEffect(() => {
    let cancelled = false;
    const filters = filtersFor(settings, flat.offerType);
    setState({ status: "loading" });
    setShowAll(false);
    setDismissed(false);
    const request: FindAlternativesRequest = { type: "FIND_ALTERNATIVES", flat };

    chrome.runtime
      .sendMessage<FindAlternativesRequest, FindAlternativesResponse>(request)
      .then((response) => {
        if (cancelled) return;
        if (!response?.ok) return setState({ status: "error", message: response?.error ?? "No response" });
        const similar = findSimilar(parsePages(response, flat, filters), flat, filters);
        setState({ status: "done", similar, failed: response.failed });
      })
      .catch((error: unknown) => !cancelled && setState({ status: "error", message: String(error) }));

    return () => {
      cancelled = true;
    };
  }, [flat, settings]);

  // Nothing to list: say so in a small note (so it's clear the extension ran), dismissible.
  if (state.status === "error" || (state.status === "done" && state.similar.length === 0)) {
    if (dismissed) return null;
    return (
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white py-1.5 pl-2 pr-2 text-sm text-zinc-600 shadow-lg ring-1 ring-zinc-200">
        <button onClick={openSettings} title="Settings" aria-label="Settings">
          <Cat className="h-7 w-7" />
        </button>
        {state.status === "error"
          ? "Couldn't reach the other sites"
          : `No similar ${flat.layout} flats found${describeFilters(filters) ? " with your filters" : ""}`}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-full px-1.5 text-base leading-none text-zinc-400 hover:bg-zinc-100"
        >
          ×
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-emerald-600 py-1.5 pl-2 pr-4 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700"
      >
        <Cat className="h-7 w-7 rounded-full bg-white p-0.5" />
        Similar flats
      </button>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-zinc-600 shadow-xl ring-1 ring-zinc-200">
        <Cat className="h-6 w-6 animate-pulse" />
        Reality Scanner: finding similar flats…
      </div>
    );
  }

  const { similar, failed } = state;
  const area = flat.neighborhood ?? flat.district ?? "Prague";
  const filterText = describeFilters(filters);

  return (
    <div className="pointer-events-auto w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-white text-zinc-900 shadow-2xl ring-1 ring-zinc-200">
      <div className="flex items-start justify-between gap-3 bg-emerald-50 px-4 py-3">
        <button onClick={openSettings} title="Settings" aria-label="Settings" className="rounded-lg hover:bg-emerald-100">
          <Cat className="h-9 w-9" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {similar.length > TOP_COUNT ? `Top ${TOP_COUNT} of ${similar.length}` : similar.length} similar{" "}
            {filters.furnishedOnly ? "furnished " : ""}
            {flat.layout} flat{similar.length === 1 ? "" : "s"} in {area}
          </p>
          <p className="mt-0.5 text-xs text-emerald-800">
            This listing: {czk.format(flat.priceCzk!)}
            {unit}
            {flat.areaM2 ? ` · ${flat.areaM2} m²` : ""}
          </p>
        </div>
        <button
          onClick={openSettings}
          title="Settings: price range, furnished only"
          aria-label="Settings"
          className="rounded px-1.5 text-base leading-none text-zinc-500 hover:bg-emerald-100"
        >
          ⚙️
        </button>
        <button
          onClick={() => setOpen(false)}
          aria-label="Minimize"
          className="rounded px-1.5 text-lg leading-none text-zinc-500 hover:bg-emerald-100"
        >
          ×
        </button>
      </div>

      <ul className={`divide-y divide-zinc-100 ${showAll ? "max-h-[55vh] overflow-y-auto" : ""}`}>
        {(showAll ? similar : similar.slice(0, TOP_COUNT)).map((alt) => (
          <li key={alt.url}>
            <a
              href={alt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{alt.address}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  {alt.title} · {SOURCE_LABELS[alt.source]}
                  {alt.noCommission && (
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800">no commission</span>
                  )}
                  {alt.furnished && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">furnished</span>
                  )}
                </span>
                {!!alt.alsoOn?.length && (
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Also on{" "}
                    {alt.alsoOn.map((o, i) => (
                      <span key={o.url}>
                        {i > 0 && ", "}
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => {
                            // Nested inside the row's link, so open this one explicitly.
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(o.url, "_blank", "noopener,noreferrer");
                          }}
                          className="font-medium text-emerald-700 underline hover:text-emerald-900"
                        >
                          {SOURCE_LABELS[o.source]}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-sm font-semibold">
                  {czk.format(alt.priceCzk)}
                  {unit}
                </span>
                <PriceDiff price={alt.priceCzk} reference={flat.priceCzk} />
                {alt.chargesCzk && <span className="block text-xs text-zinc-500">+ {czk.format(alt.chargesCzk)} fees</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>

      {similar.length > TOP_COUNT && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full border-t border-zinc-100 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          {showAll ? "Show top 3 only ▲" : `Show ${similar.length - TOP_COUNT} more similar flat${similar.length - TOP_COUNT === 1 ? "" : "s"} ▼`}
        </button>
      )}

      <p className="border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-500">
        {filterText ? <>Your filters: {filterText}. </> : <>No filters set. </>}
        <button onClick={openSettings} className="font-medium text-emerald-700 underline hover:text-emerald-900">
          Change settings
        </button>
        <br />
        Compared live from your browser. Prices as listed; check fees on each site.
        {failed.length > 0 && <> Couldn't reach {failed.map((s) => SOURCE_LABELS[s]).join(", ")}.</>}
      </p>
    </div>
  );
}
