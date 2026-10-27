import { bindings, defineConfig, defineWorker } from "cf/config";

// Neon credentials live in .env.local (written by `neon deploy`); only used for local dev.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

export default defineConfig({
  worker: defineWorker({
    name: "reality-scanner-cz",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-27",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // Workers AI: parses natural-language search queries.
      AI: bindings.ai({ dev: { remote: true } }),
      // Gemini API key (Google Search grounding). Local dev reads it from .dev.vars.
      GOOGLE_GENERATIVE_AI_API_KEY: bindings.secret(),
      // Hyperdrive in front of Neon Postgres (direct connection; Hyperdrive does the pooling).
      HYPERDRIVE: bindings.hyperdrive({
        id: "688b88ef31ab4c259bcbecd24ba6695e",
        dev: { connectionString: process.env.DATABASE_URL_UNPOOLED },
      }),
    },
  }),
});
