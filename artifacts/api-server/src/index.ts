import app from "./app";
import { logger } from "./lib/logger";
import { validateMeilisearchAtStartup } from "./lib/meilisearch-config";
import { ensurePshCatalogLoaded } from "./lib/psh-pdf-store";

validateMeilisearchAtStartup();
void ensurePshCatalogLoaded().then((ok) => {
  if (!ok) logger.warn("PSH parasha catalog not loaded at startup");
});

/** Render and most hosts set PORT; default matches Render's expected listen port. */
const rawPort = process.env.PORT ?? "10000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/** Render's port scanner probes 0.0.0.0; omitting host can bind IPv6-only (::) and fail deploy. */
const host = process.env.HOST ?? "0.0.0.0";

app.listen(port, host, () => {
  logger.info({ port, host }, "Server listening");
});
