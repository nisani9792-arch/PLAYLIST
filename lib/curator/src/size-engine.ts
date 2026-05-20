export const PLAYLIST_MIN = 20;
export const PLAYLIST_TARGET = 35;
export const PLAYLIST_MAX = 50;

export type SizeContext = {
  isListMode?: boolean;
  isParasha?: boolean;
  isNiche?: boolean;
  availableHits?: number;
  pshCatalogSize?: number;
  requestedTarget?: number;
};

export function computeTargetSize(ctx: SizeContext): number {
  if (ctx.isListMode) {
    return Math.min(PLAYLIST_MAX, Math.max(1, ctx.availableHits ?? PLAYLIST_MIN));
  }

  if (ctx.requestedTarget != null && Number.isFinite(ctx.requestedTarget)) {
    return clampSize(ctx.requestedTarget);
  }

  if (ctx.isParasha && ctx.pshCatalogSize != null && ctx.pshCatalogSize > 0) {
    return clampSize(Math.min(PLAYLIST_MAX, ctx.pshCatalogSize));
  }

  const available = ctx.availableHits ?? PLAYLIST_TARGET;
  if (ctx.isNiche) {
    return clampSize(Math.max(PLAYLIST_MIN, Math.floor(available * 0.7)));
  }

  if (available >= PLAYLIST_MAX) return PLAYLIST_MAX;
  if (available >= PLAYLIST_MIN) return clampSize(Math.min(PLAYLIST_TARGET, available));
  return Math.max(1, available);
}

export function clampSize(n: number): number {
  return Math.min(PLAYLIST_MAX, Math.max(PLAYLIST_MIN, Math.round(n)));
}

/** Smart fill target: grows toward 50 based on current playlist size. */
export function computeFillTarget(currentCount: number, requested?: number): number {
  if (requested != null && Number.isFinite(requested)) {
    return clampSize(Math.max(currentCount + 1, requested));
  }
  if (currentCount >= 45) return PLAYLIST_MAX;
  if (currentCount >= 35) return clampSize(Math.min(PLAYLIST_MAX, currentCount + 12));
  if (currentCount >= PLAYLIST_MIN) return clampSize(Math.min(PLAYLIST_MAX, currentCount + 18));
  return clampSize(Math.max(PLAYLIST_MIN, 30));
}
