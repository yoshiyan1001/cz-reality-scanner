import "server-only";

import { env } from "cloudflare:workers";
import { Client } from "pg";

export type MetroLine = "A" | "B" | "C";

export type PropertyNearMetro = {
  id: number;
  title: string;
  address: string;
  district: string;
  disposition: string;
  areaM2: number;
  priceCzk: number;
  latitude: number;
  longitude: number;
  nearestStation: string;
  distanceMeters: number;
};

const MAX_RADIUS_METERS = 5000;

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  // Hyperdrive pools connections at the edge, so a fresh client per request is cheap
  // (and Workers can't share I/O objects across requests anyway).
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export type NearestStation = { name: string; line: MetroLine; distanceMeters: number };

/**
 * For each point, the closest station (optionally restricted to one line) and the
 * geodesic distance to it. Result order matches `points`.
 */
export async function findNearestStations(
  points: { latitude: number; longitude: number }[],
  line: MetroLine | null,
): Promise<NearestStation[]> {
  if (points.length === 0) return [];

  return withClient(async (client) => {
    const { rows } = await client.query<NearestStation & { idx: string }>(
      `
      SELECT pt.idx, s."name", s."line",
             ST_Distance(pt.geom::geography, s."location"::geography) AS "distanceMeters"
      FROM unnest($1::float8[], $2::float8[]) WITH ORDINALITY AS i(lat, lng, idx)
      CROSS JOIN LATERAL (SELECT i.idx, ST_SetSRID(ST_MakePoint(i.lng, i.lat), 4326) AS geom) pt
      CROSS JOIN LATERAL (
        SELECT "name", "line", "location" FROM "MetroStation"
        WHERE $3::"MetroLine" IS NULL OR "line" = $3::"MetroLine"
        ORDER BY "location" <-> pt.geom
        LIMIT 1
      ) s
      ORDER BY pt.idx
      `,
      [points.map((p) => p.latitude), points.map((p) => p.longitude), line],
    );
    return rows.map(({ name, line, distanceMeters }) => ({ name, line, distanceMeters }));
  });
}

/**
 * Properties within `maxDistanceMeters` (straight-line, geodesic) of any station
 * on `preferredMetroLine`. Each property is returned once, paired with its
 * closest station on that line, ordered nearest-first.
 */
export async function findPropertiesNearMetroLine(
  preferredMetroLine: MetroLine,
  maxDistanceMeters: number,
): Promise<PropertyNearMetro[]> {
  const radius = Math.min(Math.max(maxDistanceMeters, 0), MAX_RADIUS_METERS);

  return withClient(async (client) => {
    // Casting to geography makes ST_DWithin/ST_Distance work in meters.
    // $1/$2 are bound parameters, never interpolated into the SQL text.
    const { rows } = await client.query<PropertyNearMetro>(
      `
      SELECT * FROM (
        SELECT DISTINCT ON (p."id")
          p."id",
          p."title",
          p."address",
          p."district",
          p."disposition",
          p."areaM2",
          p."priceCzk",
          ST_Y(p."location") AS "latitude",
          ST_X(p."location") AS "longitude",
          s."name" AS "nearestStation",
          ST_Distance(p."location"::geography, s."location"::geography) AS "distanceMeters"
        FROM "PhysicalProperty" p
        JOIN "MetroStation" s
          ON s."line" = $1::"MetroLine"
         AND ST_DWithin(p."location"::geography, s."location"::geography, $2)
        ORDER BY p."id", "distanceMeters"
      ) nearest
      ORDER BY "distanceMeters"
      `,
      [preferredMetroLine, radius],
    );
    return rows;
  });
}
