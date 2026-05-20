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
            <p className="font-semibold text-foreground mb-1.5">שלושה שלבים</p>
            <ul className="text-[13px] text-muted-foreground space-y-1 list-disc pr-4">
              <li>
                <strong className="text-foreground">בנה</strong> — הדבק רשימה, פרשת שבוע, או תאר נושא (AI)
              </li>
              <li>
                <strong className="text-foreground">התאם</strong> — אשר התאמות, בחר חלופות, סנן לפי סטטוס
              </li>
              <li>
                <strong className="text-foreground">פלייליסט</strong> — סדר, חפש מקומית, ייצא לאודו עם תצוגה מקדימה
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5">מובייל</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              ניווט תחתון בין השלבים. בדסקטופ — פלייליסט, התאמה ומלחין גלויים יחד בזמן התאמה.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5">ייצוא CSV</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              לחיצה אחת מורידה קובץ בשם הפלייליסט (למשל <span dir="ltr">שם-פלייליסט.csv</span>) — רק שירים עם התאמה במאגר.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1.5">זיכרון</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              בחירות בהתאמה וייצואים נשמרים בשרת ומשפרים הצעות AI בהמשך. הגדרות מפעיל ב־/settings.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
