"use client";

import { useActionState } from "react";
import { searchPropertiesAction, type FlatResult, type SearchResult } from "@/actions/searchProperties";

const LINE_STYLES = {
  A: "bg-green-600 text-white",
  B: "bg-yellow-400 text-black",
  C: "bg-red-600 text-white",
} as const;

const czk = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });

function LineBadge({ line }: { line: keyof typeof LINE_STYLES }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${LINE_STYLES[line]}`}>{line}</span>;
}

function FlatCard({ flat }: { flat: FlatResult }) {
  const facts = [flat.disposition, flat.areaM2 != null ? `${flat.areaM2} m²` : null, flat.address].filter(Boolean);

  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-semibold">{flat.title}</h2>
      {facts.length > 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">{facts.join(" · ")}</p>}
      {flat.nearestStation && (
        <p className="mt-1 flex items-center gap-2 text-sm">
          <LineBadge line={flat.nearestStation.line} />
          {Math.round(flat.nearestStation.distanceMeters)} m to <strong>{flat.nearestStation.name}</strong> (~
          {flat.nearestStation.walkMinutes} min walk)
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-1.5">
        {flat.offers.map((offer, i) => (
          <li key={offer.url} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="font-mono">{offer.priceCzk != null ? czk.format(offer.priceCzk) : "Price n/a"}</span>
              {i === 0 && flat.offers.length > 1 && (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
                  cheapest
                </span>
              )}
              {offer.agencyFee === "no" && (
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800 dark:bg-sky-900 dark:text-sky-100">
                  no agency fee
                </span>
              )}
            </span>
            <a
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              View on {offer.portal} ↗
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function SearchForm() {
  const [result, formAction, pending] = useActionState<SearchResult | null, FormData>(
    searchPropertiesAction,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="q"
          required
          defaultValue={result?.query ?? ""}
          placeholder="Studio near the Green line within a 10 min walk"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Searching portals…" : "Search"}
        </button>
      </form>

      {pending && <p className="text-sm text-zinc-500">Searching Czech real estate sites — this takes 10–20 seconds.</p>}

      {result && !result.ok && <p className="text-red-600">{result.error}</p>}

      {result?.ok && (
        <section className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            {result.params.preferredMetroLine ? (
              <>
                <LineBadge line={result.params.preferredMetroLine} />
                within {result.params.maxWalkMinutes} min walk (~{result.params.maxDistanceMeters} m) ·
              </>
            ) : (
              "Any metro line ·"
            )}{" "}
            {result.flats.length} flat{result.flats.length === 1 ? "" : "s"}
          </p>

          <ul className="flex flex-col gap-3">
            {result.flats.map((flat) => (
              <FlatCard key={flat.offers[0].url} flat={flat} />
            ))}
          </ul>

          {result.unlocated.length > 0 && (
            <details className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
              <summary className="cursor-pointer text-sm">
                {result.unlocated.length} more without an exact address (metro distance unknown)
              </summary>
              <ul className="mt-3 flex flex-col gap-3">
                {result.unlocated.map((flat) => (
                  <FlatCard key={flat.offers[0].url} flat={flat} />
                ))}
              </ul>
            </details>
          )}

          {result.searchSuggestionsHtml && (
            // Google requires showing its Search Suggestions alongside grounded results.
            <iframe
              title="Google Search suggestions"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={`<base target="_blank">${result.searchSuggestionsHtml}`}
              className="h-24 w-full border-0"
            />
          )}

          <p className="text-xs text-zinc-500">
            Results found via Google Search. Listings belong to the linked websites — check details there.
          </p>
        </section>
      )}
    </div>
  );
}
