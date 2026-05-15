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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
