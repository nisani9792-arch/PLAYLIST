import { Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { downloadTrainingJson } from '@/lib/playlist-learning';

export function LearningExportButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 ring-1 ring-transparent hover:ring-primary/25 transition-all"
          aria-label="ייצוא נתונים מצטברים לאימון עתידי"
          onClick={() => downloadTrainingJson()}
        >
          <Brain className="h-5 w-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        מוריד קובץ JSON עם סטטיסטיקות ז&apos;אנרים/תגיות והיסטוריית ייצואים — לשימוש עתידי באימון מודל (מקומי בלבד).
      </TooltipContent>
    </Tooltip>
  );
}
