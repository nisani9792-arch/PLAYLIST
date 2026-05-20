import { parseVibeFromPrompt } from '@workspace/curator';
import { promptLooksLikeParasha } from './parasha';

export const DEFAULT_PLAYLIST_NAME = 'פלייליסט חדש';

const PLACEHOLDER_NAMES = new Set([
  '',
  DEFAULT_PLAYLIST_NAME,
  'פלייליסט ללא שם',
]);

/** True when the user has not chosen a meaningful playlist title. */
export function isDefaultPlaylistName(name: string): boolean {
  const trimmed = name.trim();
  if (PLACEHOLDER_NAMES.has(trimmed)) return true;
  return /^פלייליסט(\s|$)/i.test(trimmed);
}

export function formatParashaPlaylistName(parasha: string): string {
  const clean = parasha.trim().replace(/\s+/g, ' ');
  if (!clean) return DEFAULT_PLAYLIST_NAME;
  if (/^פרשת\s+/i.test(clean)) return clean;
  if (/^פרשה\s+/i.test(clean)) return clean.replace(/^פרשה\s+/i, 'פרשת ');
  return `פרשת ${clean}`;
}

const TOPIC_CANONICAL: Array<{ test: RegExp; label: string }> = [
  { test: /ערב\s*קליל|ערב\s*קלי/i, label: 'ערב קליל' },
  { test: /שבת\s*קודש|קודש\s*שבת/i, label: 'שבת קודש' },
  { test: /הכנה\s*לשבת|לפני\s*שבת|שירי\s*שבת/i, label: 'שבת קודש' },
  { test: /מוצאי\s*שבת|מוצ"ש|מוצאי/i, label: 'מוצאי שבת' },
  { test: /לפני\s*חתונה|יום\s*החתונה|חתונה/i, label: 'חתונה' },
  { test: /חנוכה/i, label: 'חנוכה' },
  { test: /פורים/i, label: 'פורים' },
  { test: /סוכות/i, label: 'סוכות' },
  { test: /פסח/i, label: 'פסח' },
  { test: /ימים\s*נוראים|ראש\s*השנה|יום\s*כיפור/i, label: 'ימים נוראים' },
  { test: /אמונה|השראה/i, label: 'אמונה והשראה' },
];

function canonicalTopicLabel(prompt: string): string | null {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  for (const { test, label } of TOPIC_CANONICAL) {
    if (test.test(trimmed)) return label;
  }
  const vibe = parseVibeFromPrompt(trimmed);
  if (vibe.moodHint && vibe.moodHint !== 'מגוון' && trimmed.length <= 64) {
    const hint = vibe.moodHint.trim();
    if (hint.length >= 3 && hint.length <= 32 && !trimmed.includes(hint)) {
      return trimmed.length <= 40 ? trimmed : hint;
    }
  }
  if (trimmed.length <= 48) return trimmed;
  const firstLine = trimmed.split('\n').map((l) => l.trim()).find(Boolean);
  return firstLine && firstLine.length <= 48 ? firstLine : trimmed.slice(0, 48).trim();
}

export function inferPlaylistDisplayName(input: {
  parasha?: string | null;
  prompt?: string | null;
}): string | null {
  const parasha = input.parasha?.trim();
  if (parasha) return formatParashaPlaylistName(parasha);

  const prompt = input.prompt?.trim();
  if (!prompt) return null;

  if (promptLooksLikeParasha(prompt)) {
    const withoutPrefix = prompt
      .replace(/^פרשת\s+/i, '')
      .replace(/^פרשה\s+/i, '')
      .trim();
    if (withoutPrefix) return formatParashaPlaylistName(withoutPrefix);
    return formatParashaPlaylistName(prompt);
  }

  return canonicalTopicLabel(prompt);
}

export function resolveAutoPlaylistName(
  currentName: string,
  suggested: string | null | undefined,
): string {
  if (!isDefaultPlaylistName(currentName)) return currentName;
  const label = suggested?.trim();
  return label || currentName;
}
