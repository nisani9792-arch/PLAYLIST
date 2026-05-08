import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function WorkspaceHelpPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="מה האפליקציה עושה"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] text-sm" align="end" dir="rtl">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-foreground mb-1.5">מטרת JUSIC MANEGE PRO</p>
            <p className="text-muted-foreground leading-relaxed text-[13px]">
              עמדת עריכת פלייליסטים לצוותים שמכינים רשימות השמעה מדויקות: חיפוש במאגר עם פילטרים,
              סידור וגרירה, ייבוא מטקסט חופשי ו-AI, וייצוא CSV לאודו.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5">פילטרים לפני חיפוש</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">רק שירים</strong> מופעל כברירת מחדל (מתאים גם לייבוא מטקסט ול-AI).
              ניתן להוסיף <strong className="text-foreground">ז&apos;אנר</strong> מדויק כפי שהוא מופיע במאגר — אם אין תוצאות,
              נסה בלי ז&apos;אנר או בדוק את שם השדה במאנדקס Meilisearch (<code className="text-xs bg-muted px-1 rounded">genres</code>).
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5">אזורים במסך</p>
            <ul className="text-[13px] text-muted-foreground space-y-1 list-disc pr-4">
              <li>פס הפילטרים + חיפוש — הוספת שירים בודדים</li>
              <li>ייבוא מרשימה — אותם פילטרים נשמרים להתאמת השורות</li>
              <li>AI מוזיקלי — אותם פילטרים בהתאמת השירים</li>
              <li>מרכז — הפלייליסט (גרירה, הסרה, ייצוא לאודו)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5">טיוטה ולמידה עתידית</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              הטיוטה נשמרת אוטומטית בדפדפן, כולל בעת סגירת טאב או קריסה — עם סנכרון לפני יציאה מהעמוד.
              כפתור המוח ליד כאן מוריד JSON עם סטטיסטיקות ז&apos;אנרים/תגיות והיסטוריית ייצואים לשימוש עתידי באימון מודל.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
