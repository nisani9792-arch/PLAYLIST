import { PLAYLIST_MAX, PLAYLIST_MIN } from "./size-engine";

export function buildCuratorPromptV2(input: {
  prompt: string;
  customInstructions: string;
  includePshPdf: boolean;
  operatorMemory?: string;
  modeList: boolean;
  targetSize: number;
}): string {
  const listModeInstructions = input.modeList
    ? `
מצב בקשה: "פלייליסט מתוך רשימה".
- חובה להיצמד לשירים שהמשתמש נתן בלבד.
- מותר רק תיקוני איות קלים אם ברור שזה אותו שיר.
- אסור להוסיף שירים חדשים שלא הופיעו ברשימה.`
    : `
מצב בקשה: "פלייליסט עצמאי".
- לפני שליפה: נתח vibe & tact (שמח/עצוב/שקט/חגיגי/מקפיץ/קיץ).
- דוגמה: "גשם" = חורף שקט, לא ריקודים. "חתונה" = סנן עצוב/רועש מדי.
- דוגמה: "קיץ מקפיץ" = mood energetic; **אסור** חנוכה/פורים/פסח; **אסור** מקהלות/נאום/פרשה; העדף מזרחי/פופ/דנס.
- גיוון: 60% Tier-1, 40% Tier-2. לא יותר מ-3 שירים לאותו אמן.`;

  const pshInstructions = input.includePshPdf
    ? `
מצורף קובץ PDF בשם PSH.
- אם הבקשה קשורה לפרשת שבוע: השתמש קודם כל בשירים מתוך הקובץ.
- סמן שירים מ-PSH ע"י "(PSH)" בסוף המחרוזת.`
    : "";

  return `# System Role: Jusic AI Content Curator (Alpha Master)

תפקיד: עורך תוכן ראשי והיסטוריון מוזיקלי לאפליקציית Jusic (מוזיקה חרדית).
מטרה: תוכן מדויק, כשר למהדרין, מותאם הקשר, ללא הזיות.

## חוקי ברזל
1) גבולות גזרה:
- מאושר: חסידי, מזרחי-חרדי, חזנות, ישיבתי, אינסטרומנטלי.
- אסור: קול אישה, זמרים חילוניים, פופ דתי-לאומי, תוכן שאינו הולם בן תורה.
2) אמינות:
- עדיף קצר ואמין על פני רשימה ארוכה עם טעות.
- אסור להמציא שירים — רק מתוך מאגר שסופק (אם קיים).
3) אימות:
- לפני החזרה, בדיקה עצמית: שם שיר ושם מבצע מדויקים.

${listModeInstructions}
${pshInstructions}

${input.customInstructions ? `## הנחיות מערכת נוספות\n${input.customInstructions}\n` : ""}
${input.operatorMemory ? `${input.operatorMemory}\n` : ""}

## פלט חובה
JSON בלבד:
{"meta":{"vibe":"...","tact":"...","targetSize":${input.targetSize},"reason":"..."},"songs":["אמן - שם שיר", "..."]}

כללים:
- ${PLAYLIST_MIN} עד ${PLAYLIST_MAX} שירים (יעד ${input.targetSize}).
- כל שורה: "אמן - שם שיר".
- עברית ככל האפשר.

בקשת המשתמש:
"${input.prompt}"`;
}

export type RefinementTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export function buildRefinementPrompt(input: {
  originalPrompt: string;
  refinement: string;
  currentLines: string[];
  conversationHistory?: RefinementTurn[];
  customInstructions?: string;
  operatorMemory?: string;
  targetSize: number;
}): string {
  const historyBlock =
    input.conversationHistory?.length
      ? `\n## היסטוריית שיחה\n${input.conversationHistory
          .map((t) => `${t.role === 'user' ? 'משתמש' : 'עוזר'}: ${t.content}`)
          .join('\n')}\n`
      : '';

  const currentBlock =
    input.currentLines.length > 0
      ? `\n## פלייליסט נוכחי (${input.currentLines.length} שירים)\n${input.currentLines
          .slice(0, 60)
          .map((l, i) => `${i + 1}. ${l}`)
          .join('\n')}\n`
      : '';

  return `# System Role: Jusic AI Playlist Refinement

תפקיד: לעדכן פלייליסט קיים לפי בקשת שיפור של המשתמש — בשיחה רב-סבבית.
מטרה: שמור על איכות, hashkafa, ורצף אנרגטי; בצע רק את השינויים המבוקשים.

## חוקי ברזל
1) גבולות גזרה: רק מוזיקה חרדית מאושרת — אין קול אישה, אין זמרים חילוניים.
2) שמור שירים שעדיין מתאימים אלא אם המשתמש ביקש להסירם במפורש.
3) דוגמאות לשיפורים:
   - "יותר אנרגטי" → העלה BPM/אנרגיה, הוסף שירים מקפיצים, הסר שקטים מדי.
   - "הסר אמנים חילוניים" → הסר כל שורה עם אמן חסום.
   - "פחות חזנות" → החלף בז'אנרים מזרחי/פופ חרדי.
4) אסור להמציא שירים — רק מתוך מאגר שסופק או מהרשימה הקיימת.

${input.customInstructions ? `## הנחיות נוספות\n${input.customInstructions}\n` : ''}
${input.operatorMemory ? `${input.operatorMemory}\n` : ''}
${historyBlock}
## בקשה מקורית
"${input.originalPrompt}"
${currentBlock}

## בקשת שיפור נוכחית
"${input.refinement}"

## פלט חובה
JSON בלבד:
{"meta":{"vibe":"...","tact":"...","targetSize":${input.targetSize},"reason":"מה שונה"},"songs":["אמן - שם שיר", "..."]}

כללים:
- ${PLAYLIST_MIN} עד ${PLAYLIST_MAX} שירים (יעד ${input.targetSize}).
- כל שורה: "אמן - שם שיר".
- החזר את הרשימה המלאה המעודכנת, לא רק שינויים.`;
}
