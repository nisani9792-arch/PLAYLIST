import type { ParashaValidationContext, PshSongRow } from '@workspace/playlist-validation';

export type StagingParashaContext = ParashaValidationContext;

export type StagingPshRow = PshSongRow & { line?: string };
