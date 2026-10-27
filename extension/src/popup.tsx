import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import catIcon from "../public/icons/icon-48.png";
import "./popup.css";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type PriceRange, type Settings } from "./settings";

const SAVE_DELAY_MS = 400;

/** "25 000" / "25000" / "" -> number | null */
const parseCzk = (value: string): number | null => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : null;
};
const formatCzk = (value: number | null) => (value == null ? "" : value.toLocaleString("cs-CZ"));

function PriceInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(formatCzk(value));
  useEffect(() => setText(formatCzk(value)), [value]);

  return (
    <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
      {label}
      <span className="flex items-center rounded-md border border-zinc-300 bg-white focus-within:border-emerald-600">
        <input
          inputMode="numeric"
          value={text}
          placeholder="any"
          onChange={(e) => {
            setText(e.target.value);
            onChange(parseCzk(e.target.value));
          }}
          onBlur={() => setText(formatCzk(parseCzk(text)))}
          className="w-full rounded-md px-2 py-1.5 text-sm text-zinc-900 outline-none"
        />
        <span className="pr-2 text-xs text-zinc-400">Kč</span>
      </span>
    </label>
  );
}

function RangeFields({
  title,
  hint,
  range,
  onChange,
}: {
  title: string;
  hint: string;
  range: PriceRange;
  onChange: (range: PriceRange) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-zinc-900">{title}</legend>
      <div className="flex gap-2">
        <PriceInput label="From" value={range.min} onChange={(min) => onChange({ ...range, min })} />
        <PriceInput label="To" value={range.max} onChange={(max) => onChange({ ...range, max })} />
      </div>
      <p className="text-xs text-zinc-500">{hint}</p>
    </fieldset>
  );
}

function Popup() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  /** Save shortly after the last change, so typing a price doesn't write on every key. */
  const update = (next: Settings) => {
    setSettings(next);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveSettings(next).then(() => setSaved(true)), SAVE_DELAY_MS);
  };

  if (!settings) return null;

  return (
    <main className="flex w-80 flex-col gap-4 bg-zinc-50 p-4 font-sans">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <img src={catIcon} alt="" className="h-8 w-8" />
          Reality Scanner CZ
        </h1>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ ...settings, enabled: e.target.checked })}
            className="h-4 w-4 accent-emerald-600"
          />
          Show on Sreality
        </label>
      </header>

      <p className="text-xs text-zinc-600">Only show similar flats that match these filters. With no price range, flats within ±30% of the listing's price are shown.</p>

      <RangeFields
        title="Rent per month"
        hint="Used on rental listings (pronájem)."
        range={settings.rent}
        onChange={(rent) => update({ ...settings, rent })}
      />
      <RangeFields
        title="Purchase price"
        hint="Used on listings for sale (prodej)."
        range={settings.sale}
        onChange={(sale) => update({ ...settings, sale })}
      />

      <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-900">
        <input
          type="checkbox"
          checked={settings.furnishedOnly}
          onChange={(e) => update({ ...settings, furnishedOnly: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-emerald-600"
        />
        <span>
          Furnished flats only
          <span className="block text-xs text-zinc-500">Fully furnished (vybavený / zařízený).</span>
        </span>
      </label>

      <footer className="flex items-center justify-between text-xs">
        <button onClick={() => update(DEFAULT_SETTINGS)} className="text-zinc-500 underline hover:text-zinc-800">
          Reset
        </button>
        <span className={saved ? "text-emerald-700" : "text-transparent"}>Saved ✓</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
