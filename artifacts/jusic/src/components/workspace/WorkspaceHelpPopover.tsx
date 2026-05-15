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
          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 ring-1 ring-transparent hover:ring-primary/20 transition-all"
          aria-label="מה האפליקציה עושה"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(24rem,calc(100vw-2rem))] text-sm bp-glass-panel border-border/65 shadow-2xl"
        align="end"
        dir="rtl"
      >
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-foreground mb-1.5">מטרת BUILD PLAY</p>
            <p className="text-muted-foreground leading-relaxed text-[13px]">
              עמדת עריכת פלייליסטים לצוותים שמכינים רשימות השמעה מדויקות: חיפוש במאגר עם פילטרים,
              סידור וגרירה, ייבוא מטקסט חופשי ו-AI, וייצוא CSV לאודו.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5">חיפוש במאגר</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              החיפוש מחזיר <strong className="text-foreground">שירים בלבד</strong> תמיד.
              ניתן להוסיף <strong className="text-foreground">ז&apos;אנר</strong> מדויק — אם אין תוצאות, נסה בלי ז&apos;אנר.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5">אזורים במסך</p>
            <ul className="text-[13px] text-muted-foreground space-y-1 list-disc pr-4">
              <li>פס הפילטרים + חיפוש — הוספת שירים בודדים</li>
              <li>ייבוא מרשימה — אותם פילטרים נשמרים להתאמת השורות</li>
              <li>AI מוזיקלי — נושא חופשי (22–30 שירים) או פרשת שבוע (מקובץ PSH + התאמה במאגר)</li>
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
