import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AlternativeWidget } from "./AlternativeWidget";
import { loadSettings, onSettingsChanged, type Settings } from "./settings";
import { extractFlat, isDetailPage } from "./extract";
import type { FlatInfo } from "./types";
import styles from "./widget.css?inline";

const HOST_ID = "reality-scanner-cz";
const EXTRACT_TIMEOUT_MS = 10_000;

let root: Root | null = null;
let currentPath: string | null = null;
let currentFlat: FlatInfo | null = null;

/** Sreality renders client-side, so wait until the price is on the page. */
function waitForFlat(): Promise<FlatInfo | null> {
  return new Promise((resolve) => {
    const tryExtract = () => {
      const flat = extractFlat(location, document);
      return flat?.priceCzk != null ? flat : null;
    };
    const found = tryExtract();
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const flat = tryExtract();
      if (flat) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(flat);
      }
    });
    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, EXTRACT_TIMEOUT_MS);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

function unmount() {
  root?.unmount();
  root = null;
  document.getElementById(HOST_ID)?.remove();
}

function render(flat: FlatInfo, settings: Settings) {
  root?.render(
    <StrictMode>
      <AlternativeWidget flat={flat} settings={settings} />
    </StrictMode>,
  );
}

/** Shadow DOM keeps Sreality's CSS and ours from leaking into each other. */
function mount(flat: FlatInfo, settings: Settings) {
  const host = document.createElement("div");
  host.id = HOST_ID;
  // Keep Chrome's page translation off our box: Czech street names must stay findable.
  host.setAttribute("translate", "no");
  host.className = "notranslate";
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = styles;
  const container = document.createElement("div");
  shadow.append(style, container);
  document.body.append(host);

  root = createRoot(container);
  render(flat, settings);
}

async function onRoute() {
  if (location.pathname === currentPath) return;
  currentPath = location.pathname;
  currentFlat = null;
  unmount();
  if (!isDetailPage(location)) {
    return console.info("[Reality Scanner] Running. Open a single flat listing (not a search page) to compare.");
  }

  const flat = await waitForFlat();
  if (location.pathname !== currentPath) return; // navigated away while waiting
  if (!flat) return console.info("[Reality Scanner] Skipped: not a flat listing, or couldn't read its price/layout.");
  // v1 compares Prague flats only.
  if (!flat.inPrague) return console.info("[Reality Scanner] Skipped: not in Prague.", flat);
  currentFlat = flat;
  const settings = await loadSettings();
  if (!settings.enabled) return console.info("[Reality Scanner] Disabled in settings.");
  console.info("[Reality Scanner] Comparing", flat, settings);
  mount(flat, settings);
}

// Apply changes from the settings popup to the open page right away.
onSettingsChanged((settings) => {
  if (!currentFlat) return;
  if (!settings.enabled) return unmount();
  if (root) render(currentFlat, settings);
  else mount(currentFlat, settings);
});

// Several portals (Sreality, Bezrealitky, UlovDomov) are single-page apps: detect
// client-side navigation as well as the first load.
onRoute();
const observer = new MutationObserver(() => onRoute());
observer.observe(document, { childList: true, subtree: true });
window.addEventListener("popstate", () => onRoute());
