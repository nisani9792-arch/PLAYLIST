import type { ParashaValidationContext } from '@workspace/playlist-validation';
import { promptLooksLikeParasha } from './parasha';

let cachedCatalog: ParashaValidationContext['catalogRows'] | null = null;
let cachedAllCatalog: ParashaValidationContext['allCatalogRows'] | null = null;
let cachedParasha: string | null = null;

/** Set when a parasha batch is loaded from PSH (ASI panel). */
export function setActiveParashaExportContext(
  parasha: string | null,
  catalogRows: ParashaValidationContext['catalogRows'] | null,
  allCatalogRows?: ParashaValidationContext['allCatalogRows'] | null,
): void {
  cachedParasha = parasha;
  cachedCatalog = catalogRows;
  cachedAllCatalog = allCatalogRows ?? null;
}

export function resolveParashaNameFromClient(
  playlistName: string,
): ParashaValidationContext | null {
  if (cachedParasha && cachedCatalog?.length) {
    return {
      targetParasha: cachedParasha,
      catalogRows: cachedCatalog,
      allCatalogRows: cachedAllCatalog ?? undefined,
    };
  }
  if (promptLooksLikeParasha(playlistName)) {
    return cachedCatalog?.length
      ? {
          targetParasha: playlistName,
          catalogRows: cachedCatalog,
          allCatalogRows: cachedAllCatalog ?? undefined,
        }
      : null;
  }
  return null;
}
