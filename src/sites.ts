import type { Source } from "./types";

/** Sites where the widget appears while you browse a listing. */
export type HostSite = {
  host: string;
  name: string;
  /** Listing detail pages. Unknown structure → any path with a long listing id. */
  isDetail: (path: string) => boolean;
  /** When this host is also a comparison source, don't suggest its own listings back. */
  source?: Source;
};

const longId = (path: string) => /\d{5,}/.test(path);

export const HOST_SITES: HostSite[] = [
  { host: "www.sreality.cz", name: "Sreality", isDetail: (p) => /^\/detail\/(pronajem|prodej)\/byt\//.test(p) },
  {
    host: "www.bezrealitky.cz",
    name: "Bezrealitky",
    isDetail: (p) => /^\/nemovitosti-byty-domy\/\d+/.test(p),
    source: "bezrealitky",
  },
  { host: "reality.idnes.cz", name: "Reality.iDNES.cz", isDetail: (p) => /^\/detail\//.test(p), source: "idnes" },
  { host: "www.ulovdomov.cz", name: "UlovDomov", isDetail: (p) => /^\/inzerat\//.test(p) },
  { host: "realitymix.cz", name: "RealityMIX", isDetail: (p) => /^\/detail\//.test(p), source: "realitymix" },
  { host: "www.realcity.cz", name: "Realcity", isDetail: longId },
  { host: "www.realitypro.eu", name: "RealityPro", isDetail: (p) => /^\/detail\/\d+/.test(p), source: "videobydleni" },
  { host: "www.videobydleni.cz", name: "Videobydleni", isDetail: (p) => /^\/detail\/\d+/.test(p), source: "videobydleni" },
  { host: "www.ceskereality.cz", name: "ČeskéReality", isDetail: longId },
  { host: "www.realingo.cz", name: "Realingo", isDetail: longId },
  { host: "www.remax-czech.cz", name: "RE/MAX", isDetail: (p) => /^\/reality\/detail\/\d+/.test(p), source: "remax" },
  { host: "reality.bazos.cz", name: "Bazoš", isDetail: (p) => /^\/inzerat\/\d+/.test(p) },
  {
    host: "www.expats.cz",
    name: "Expats.cz",
    isDetail: (p) => /^\/praguerealestate\/for-(rent|sale)\/apartments\/\d+/.test(p),
    source: "expats",
  },
];

/** "www.bezrealitky.cz" and "bezrealitky.cz" are the same site. */
const bare = (host: string) => host.replace(/^www\./, "");

export function hostSite(host: string): HostSite | undefined {
  return HOST_SITES.find((s) => bare(s.host) === bare(host));
}

export const SOURCE_LABELS: Record<Source, string> = {
  bezrealitky: "Bezrealitky",
  idnes: "Reality.iDNES.cz",
  realitymix: "RealityMIX",
  videobydleni: "Videobydleni",
  remax: "RE/MAX",
  expats: "Expats.cz",
};
