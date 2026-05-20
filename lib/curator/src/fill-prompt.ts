import type { RankCandidate } from "./rank-select";
import { formatArtistSongLine } from "./rank-select";

export function buildFillCuratorPrompt(
  topic: string,
  existingLines: string[],
  needed: number,
): string {
  const sample = existingLines.slice(0, 25);
  const more = existingLines.length - sample.length;
  const existingBlock = sample.map((l) => `- ${l}`).join("\n");

  return `# השלמת פלייליסט — Jusic Curator

נושא / הקשר: "${topic}"

שירים שכבר בפלייליסט (${existingLines.length} שירים) — אסור לחזור עליהם:
${existingBlock}${more > 0 ? `\n... ועוד ${more} שירים` : ""}

מטרה: בחר ${needed} שירים נוספים שמתאימים בווייב, נושא ו-hashkafa לשירים הקיימים.
- שמור על אותה אווירה, ז'אנר ורמת "חרדיות"
- גיוון באמנים (מקסימום 3 לאמן בכל הפלייליסט כולו)
- רק מוזיקה חרדית מאושרת — אין קול אישה, אין זמרים חילוניים`;
}

export function buildFillRankSelectionPrompt(
  topic: string,
  existingLines: string[],
  candidates: RankCandidate[],
  targetSize: number,
  vibeReason?: string,
): string {
  const existingSample = existingLines
    .slice(0, 15)
    .map((l) => `- ${l}`)
    .join("\n");
  const catalog = candidates
    .slice(0, 120)
    .map((c, i) => `${i + 1}. ${formatArtistSongLine(c)}`)
    .join("\n");

  return `# Jusic Curator — השלמת פלייליסט (Rank & Select)

בחר ${targetSize} שירים **חדשים** מהרשימה בלבד. אסור להמציא שירים שלא ברשימה.
אסור לבחור שיר שכבר קיים בפלייליסט.

${vibeReason ? `הקשר vibe: ${vibeReason}` : ""}

נושא: "${topic}"

שירים שכבר בפלייליסט (אסור לחזור):
${existingSample}

כללים:
- התאמה מלאה לווייב ולנושא של השירים הקיימים
- 60% Tier-1 (מוכר), 40% Tier-2 (פחות ndosh)
- מקסימום 3 שירים לאותו אמן (כולל שירים שכבר בפלייליסט)
- מאושר: חסידי, מזרחי-חרדי, חזנות, ישיבתי

מאגר מועמדים:
${catalog}

החזר JSON בלבד:
{"songs":[{"artist":"...","title":"..."}, ...]}`;
}

export function buildFillTopicQueries(
  topic: string,
  existingLines: string[],
): string[] {
  const queries = new Set<string>();
  queries.add(topic.trim());

  for (const line of existingLines.slice(0, 8)) {
    const [artist, title] = line.split(" - ").map((s) => s.trim());
    if (artist && title) {
      queries.add(`${topic} ${title}`.trim());
      queries.add(`${artist} ${topic}`.trim());
    } else if (title || artist) {
      queries.add(`${topic} ${title || artist}`.trim());
    }
  }

  return [...queries].filter((q) => q.length >= 2).slice(0, 10);
}
