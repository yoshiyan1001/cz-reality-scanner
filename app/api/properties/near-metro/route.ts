import { z } from "zod";
import { findPropertiesNearMetroLine } from "@/lib/db/spatialSearch";

const WALKING_METERS_PER_MINUTE = 80;

const querySchema = z.object({
  line: z.enum(["A", "B", "C"]),
  minutes: z.coerce.number().int().min(1).max(60).default(10),
});

// GET /api/properties/near-metro?line=A&minutes=10
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const { line, minutes } = parsed.data;
  const maxDistanceMeters = minutes * WALKING_METERS_PER_MINUTE;
  const properties = await findPropertiesNearMetroLine(line, maxDistanceMeters);

  return Response.json({ line, minutes, maxDistanceMeters, properties });
}
