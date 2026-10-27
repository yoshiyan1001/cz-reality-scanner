"use server";

import { createAI } from "agents/models/ai-sdk";
import { generateText, Output } from "ai";
import { env } from "cloudflare:workers";
import { z } from "zod";

const searchParamsSchema = z.object({
  preferredMetroLine: z
    .enum(["A", "B", "C"])
    .nullable()
    .describe("Prague Metro line: A = green, B = yellow, C = red; null if no line or station is mentioned"),
  maxWalkMinutes: z
    .number()
    .int()
    .min(1)
    .max(60)
    .describe("Maximum walking time to the nearest station, in minutes"),
});

export type ParsedSearchParams = z.infer<typeof searchParamsSchema>;

const INSTRUCTIONS = `You convert Prague apartment search requests (English or Czech) into search parameters.

Metro line mapping:
- "A", "green", "zelená", "zelené" -> A
- "B", "yellow", "žlutá", "žluté" -> B
- "C", "red", "červená", "červené" -> C
If the user names a station instead of a line, use that station's line
(e.g. Malostranská, Dejvická, Náměstí Míru -> A; Anděl, Náměstí Republiky -> B;
I. P. Pavlova, Nádraží Holešovice, Vyšehrad -> C).
If neither a line nor a station is mentioned, use null.

Walking time: convert any distance to minutes at 80 m/min (e.g. "800 m" -> 10).
If no time or distance is given, use 10.`;

export async function parseSearchQuery(query: string): Promise<ParsedSearchParams> {
  const ai = createAI({ binding: env.AI });

  const { output } = await generateText({
    model: ai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
    instructions: INSTRUCTIONS,
    prompt: query,
    output: Output.object({ schema: searchParamsSchema }),
  });

  return output;
}
