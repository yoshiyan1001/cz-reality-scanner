import { type MetroLine, PrismaClient } from "@prisma/client";
import stationData from "./data/prague-metro-stations.json" with { type: "json" };

// Seeding runs from Node, so connect directly rather than through Hyperdrive.
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL_UNPOOLED });

const LINE_COLORS: Record<MetroLine, string> = {
  A: "green",
  B: "yellow",
  C: "red",
};

type StationSeed = { name: string; line: MetroLine; lat: number; lng: number };

// All 61 Prague Metro stations (one row per line), derived from OpenStreetMap
// route relations. © OpenStreetMap contributors, ODbL.
const stations = stationData as StationSeed[];

type PropertySeed = {
  title: string;
  address: string;
  district: string;
  disposition: string;
  areaM2: number;
  priceCzk: number;
  lat: number;
  lng: number;
};

const properties: PropertySeed[] = [
  {
    // ~230 m west of Malostranská
    title: "Studio under Prague Castle",
    address: "Valdštejnská 12, Malá Strana",
    district: "Praha 1",
    disposition: "1+kk",
    areaM2: 32,
    priceCzk: 24500,
    lat: 50.0905,
    lng: 14.406,
  },
  {
    // ~290 m south-east of Malostranská, by the river
    title: "Riverside 2+kk near Charles Bridge",
    address: "U Lužického semináře 20, Malá Strana",
    district: "Praha 1",
    disposition: "2+kk",
    areaM2: 58,
    priceCzk: 38000,
    lat: 50.0885,
    lng: 14.411,
  },
  {
    // ~240 m from Náměstí Míru (A)
    title: "Bright Vinohrady flat with balcony",
    address: "Korunní 18, Vinohrady",
    district: "Praha 2",
    disposition: "2+1",
    areaM2: 71,
    priceCzk: 31000,
    lat: 50.076,
    lng: 14.441,
  },
  {
    // ~380 m from Nádraží Holešovice (C)
    title: "Loft studio in Holešovice",
    address: "Argentinská 30, Holešovice",
    district: "Praha 7",
    disposition: "1+kk",
    areaM2: 38,
    priceCzk: 19900,
    lat: 50.106,
    lng: 14.442,
  },
  {
    // Far west — several km from any seeded station
    title: "Family flat in Řepy",
    address: "Makovského 1340, Řepy",
    district: "Praha 6",
    disposition: "3+1",
    areaM2: 76,
    priceCzk: 22000,
    lat: 50.07,
    lng: 14.3,
  },
];

async function main() {
  // Idempotent: wipe and re-seed so the script can be rerun freely.
  await prisma.$executeRaw`TRUNCATE "PhysicalProperty", "MetroStation" RESTART IDENTITY`;

  for (const s of stations) {
    await prisma.$executeRaw`
      INSERT INTO "MetroStation" ("name", "line", "line_color", "latitude", "longitude", "location")
      VALUES (
        ${s.name},
        ${s.line}::"MetroLine",
        ${LINE_COLORS[s.line]},
        ${s.lat},
        ${s.lng},
        ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)
      )`;
  }

  for (const p of properties) {
    await prisma.$executeRaw`
      INSERT INTO "PhysicalProperty" ("title", "address", "district", "disposition", "areaM2", "priceCzk", "location")
      VALUES (
        ${p.title},
        ${p.address},
        ${p.district},
        ${p.disposition},
        ${p.areaM2},
        ${p.priceCzk},
        ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)
      )`;
  }

  console.log(`Seeded ${stations.length} metro stations and ${properties.length} properties.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
