<p align="center">
  <img src="public/icons/icon-128.png" width="96" alt="Reality Scanner CZ cat icon">
</p>

<h1 align="center">Reality Scanner CZ</h1>

<p align="center">
  A Chrome extension for flat hunting in Prague.<br>
  While you look at a listing, it shows you <b>similar flats from other Czech real estate sites</b>,
  like Skyscanner does for flights.
</p>

---

## What it does

Open any Prague flat listing, for example on Sreality, and a small box appears in the bottom-right corner:

```
🐱 Top 3 of 18 similar 1+kk flats in Kobylisy
   This listing: 14 900 Kč/month · 25 m²

   Kyselova, Praha 8 - Kobylisy        15 000 Kč/month
   1+kk 25 m² · Reality.iDNES.cz                  +100 Kč

   Kyselova, Praha - Kobylisy          14 900 Kč/month
   1+kk 23 m² · Bezrealitky  [no commission]   same price

   Na Truhlářce, Praha 8 - Libeň       18 500 Kč/month
   1+kk 27 m² · Reality.iDNES.cz                +3 600 Kč
   Also on RealityMIX

   Show 15 more similar flats ▼
```

- **Similar flats** have the same layout (e.g. 2+kk), are in the same neighbourhood or district, are a similar size, and cost within ±5 000 Kč (rent) or ±30 % (sale).
- **The 3 most similar are shown first**: the smallest price difference first, then the closest size. Scroll the list or click *Show more* for the rest.
- **Each flat shows its first photo**, loaded straight from its site (never copied or stored).
- **−/+** is the price difference from the listing you're viewing: blue − is cheaper, red + is more expensive.
- **The same flat on several sites** is shown once, with *Also on …* links.
- **no commission** marks flats offered directly by the owner, so no agency fee.
- **furnished** and **+ fees** (monthly service charges) are shown when the site lists them.

## Supported sites

| Site | Box appears while browsing | Similar flats come from it |
|---|:---:|:---:|
| Sreality.cz | ✅ | — |
| Bezrealitky.cz | ✅ | ✅ |
| Reality.iDNES.cz | ✅ | ✅ |
| RealityMIX.cz | ✅ | ✅ |
| Videobydleni.cz | ✅ | ✅ |
| RE/MAX Czech | ✅ | ✅ |
| Expats.cz | ✅ | ✅ |
| RealityPro.eu | ✅ | — (same listings as Videobydleni) |
| UlovDomov.cz | ✅ | — |
| ČeskéReality.cz, Realingo.cz, Realcity.cz, Reality.Bazos.cz | ✅ | — |

Similar flats are only fetched from sites whose `robots.txt` allows it. The box never suggests listings from the site you're already on.

## Install

You need [Google Chrome](https://www.google.com/chrome/) (or another Chromium browser such as Edge or Brave) and [Node.js](https://nodejs.org/) 22 or newer.

1. **Download and build**

   ```bash
   git clone https://github.com/yoshiyan1001/cz-reality-scanner.git
   cd cz-reality-scanner
   npm install
   npm run build
   ```

   This creates a `dist` folder containing the ready-to-use extension.

2. **Load it into Chrome**
   1. Open `chrome://extensions` in the address bar.
   2. Turn on **Developer mode** (top-right switch).
   3. Click **Load unpacked** and choose the `dist` folder.

3. **Pin the cat icon**
   Click the puzzle-piece icon 🧩 in Chrome's toolbar and click the pin 📌 next to *Reality Scanner CZ*.

### Update to a newer version

```bash
git pull
npm install
npm run build
```

Then click **reload ↻** on *Reality Scanner CZ* in `chrome://extensions`.

## Use

1. Open a **single flat listing** (not a search results page) in Prague on any supported site.
2. The cat box appears in the bottom-right corner after a few seconds.
   - Click a flat to open it on its own site in a new tab.
   - Click **×** to minimise the box; click **🐱 Similar flats** to bring it back.
   - If nothing matches, you'll see a small *"No similar flats found"* note instead.

### Settings

Click the **cat icon in the toolbar**, the cat or ⚙️ in the box, or *Change settings* at the bottom of the box.

| Setting | What it does |
|---|---|
| **Show on property sites** | Turn the box on or off everywhere. |
| **Rent per month: From / To** | Only show rentals in this price range. This replaces the default ±5 000 Kč window. |
| **Purchase price: From / To** | The same for flats for sale. This replaces the default ±30 % window. |
| **Furnished flats only** | Only fully furnished flats (*vybavený / zařízený*). |

Settings save automatically, sync across your Chrome browsers, and update the open page immediately.

## Privacy

- **Runs entirely in your browser.** There is no server, no account and no tracking.
- **What it fetches:** to find similar flats, it loads the search results pages of the supported sites from your browser, without your cookies or logins. Results are kept for 10 minutes, so revisiting a page doesn't fetch again. Listing photos load directly from each site, the same way they do when you visit it.
- **What it stores:** only your settings, in Chrome's sync storage.
- **Permissions:** `storage` (your settings) and access to the six sites it compares against.

## Limitations

- **Prague only** for now. Listings elsewhere are skipped.
- **Standard layouts only** (1+kk … 6+1); *atypický* flats and rooms aren't compared.
- **Furnished-only filter:** many sites don't show furnishing on their result pages, so this filter mostly keeps flats from Bezrealitky and iDNES.
- **Site redesigns:** real estate sites change their pages from time to time. If the box stops appearing on a site, see below.

## Troubleshooting

**The box doesn't appear**

1. Make sure you're on a single listing page, not a search results page.
2. In `chrome://extensions` → *Reality Scanner CZ* → **Details**, check that **Site access** is *On all sites*.
3. Open the page console (right-click → **Inspect** → **Console**), type `Reality Scanner` into the **Filter** box, and reload the page. The message explains what happened:
   - **"Running. Open a single flat listing…"** — you're not on a listing page.
   - **"Skipped: not a flat listing, or couldn't read its price/layout"** — the page isn't a flat, or the site changed its layout. Please [open an issue](https://github.com/yoshiyan1001/cz-reality-scanner/issues) with the page URL.
   - **"Skipped: not in Prague"** — only Prague is supported.
   - **No message at all** — the extension isn't running on that site. Check *Site access* (step 2).

**Prices look wrong with Chrome's page translation on.** Translation is supported, but if a price is misread, please open an issue with a screenshot.

## Development

```bash
npm run dev        # build with hot reload into dist/ (load dist/ once, edits apply live)
npm run build      # production build into dist/
npm run typecheck  # TypeScript only
npm run zip        # build and pack dist/ into reality-scanner-cz.zip (e.g. for the Chrome Web Store)
```

Built with React, TypeScript, Tailwind CSS, Vite and [`@crxjs/vite-plugin`](https://crxjs.dev/) (Manifest V3).

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest: sites, permissions, icons |
| `src/content.tsx` | Runs on listing pages, reads the flat and mounts the box (in a Shadow DOM) |
| `src/extract.ts` | Reads layout, price, size and location from the open listing |
| `src/background.ts` | Service worker: fetches the other sites' search pages |
| `src/sources.ts` | Search URLs and result parsers per site, similarity ranking and duplicate merging |
| `src/sites.ts` | Supported sites and their listing URL patterns |
| `src/AlternativeWidget.tsx` | The box shown on the page |
| `src/popup.tsx`, `src/settings.ts` | Settings popup and stored settings |
| `src/prague-*.ts` | Prague's 112 neighbourhoods and which districts (Praha 1–10) they belong to |

**Adding a site:** add it to `HOST_SITES` in `src/sites.ts` and its domain to `content_scripts.matches` in `manifest.json`. To also fetch similar flats from it, add a search URL in `searchUrls()` and a parser in `src/sources.ts`, plus the domain in `host_permissions`. Check the site's `robots.txt` first.

## Credits

Neighbourhood and district data is based on Czech Wikipedia ([Seznam katastrálních území v Praze](https://cs.wikipedia.org/wiki/Seznam_katastr%C3%A1ln%C3%ADch_%C3%BAzem%C3%AD_v_Praze), [Administrativní dělení Prahy](https://cs.wikipedia.org/wiki/Administrativn%C3%AD_d%C4%9Blen%C3%AD_Prahy)), CC BY-SA 4.0.

Listings belong to the sites they're published on; the extension only links to them.
