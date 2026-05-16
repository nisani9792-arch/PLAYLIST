import type { ParashaValidationContext } from '@workspace/playlist-validation';
import { promptLooksLikeParasha } from './parasha';

let cachedCatalog: ParashaValidationContext['catalogRows'] | null = null;
let cachedParasha: string | null = null;

/** Set when a parasha batch is loaded from PSH (ASI panel). */
export function setActiveParashaExportContext(
  parasha: string | null,
  catalogRows: ParashaValidationContext['catalogRows'] | null,
): void {
  cachedParasha = parasha;
  cachedCatalog = catalogRows;
}

export function resolveParashaNameFromClient(
  playlistName: string,
): ParashaValidationContext | null {
  if (cachedParasha && cachedCatalog?.length) {
    return { targetParasha: cachedParasha, catalogRows: cachedCatalog };
  }
  if (promptLooksLikeParasha(playlistName)) {
    return cachedCatalog?.length
      ? { targetParasha: playlistName, catalogRows: cachedCatalog }
      : null;
  }
  return null;
}
