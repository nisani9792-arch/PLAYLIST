import { operatorHeaders } from './operator';

/** Same intent as server — פרשה / הפטרה in prompt → use PSH catalog, not Gemini. */
const PARASHA_INTENT_RE = /פרש|פטרה|הפטרה|parash/i;

export function promptLooksLikeParasha(prompt: string): boolean {
  return PARASHA_INTENT_RE.test(prompt.trim());
}

export type ParashaResolveResponse = {
  parasha: string;
  lines: string[];
  parashaLines: string[];
  haftarahLines: string[];
  pdfSongCount: number;
  parashaOnlyCount: number;
  haftarahCount: number;
  source: string;
  error?: string;
};

export async function resolveParashaFromPdf(
  prompt: string,
): Promise<ParashaResolveResponse> {
  const res = await fetch('/api/parasha/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...operatorHeaders() },
    body: JSON.stringify({ prompt, maxSongs: 30 }),
  });

  const data = (await res.json()) as ParashaResolveResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Parasha lookup failed: ${res.status}`);
  }
  return data;
}
