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
