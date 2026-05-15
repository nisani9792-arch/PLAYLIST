const PARASHA_TOKENS = [
  'פרשה',
  'פרשת',
  'פטרה',
  'הפטרה',
  'בראשית',
  'נח',
  'לך לך',
  'וירא',
  'שמות',
  'וארא',
  'בא',
  'בשלח',
  'יתרו',
  'משפטים',
  'תרומה',
  'תצוה',
  'ויקרא',
  'במדבר',
  'דברים',
  'וילך',
  'האזינו',
];

export function promptLooksLikeParasha(prompt: string): boolean {
  const p = prompt.trim();
  if (!p) return false;
  return PARASHA_TOKENS.some((t) => p.includes(t));
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxSongs: 30 }),
  });

  const data = (await res.json()) as ParashaResolveResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Parasha lookup failed: ${res.status}`);
  }
  return data;
}
