import { useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StagingItem } from './StagingArea';

type MobileSwipeReviewProps = {
  items: StagingItem[];
  onApprove: (item: StagingItem) => void;
  onSkip: (item: StagingItem) => void;
  onDone: () => void;
  className?: string;
};

export function MobileSwipeReview({
  items,
  onApprove,
  onSkip,
  onDone,
  className,
}: MobileSwipeReviewProps) {
  const reviewItems = items.filter((i) => i.status === 'review' || i.status === 'not-found');
  const [index, setIndex] = useState(0);
  const current = reviewItems[index];

  if (!reviewItems.length) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center gap-3', className)}>
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <p className="text-sm font-semibold">אין פריטים לבדיקה</p>
        <Button onClick={onDone}>המשך לפלייליסט</Button>
      </div>
    );
  }

  if (!current) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 gap-3', className)}>
        <p className="text-sm">סיימת לבדוק!</p>
        <Button onClick={onDone}>המשך לפלייליסט</Button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col flex-1 min-h-0 p-4 gap-4', className)}>
      <p className="text-xs text-muted-foreground text-center tabular-nums">
        {index + 1} / {reviewItems.length}
      </p>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-border/55 bg-card/88 backdrop-blur-xl p-6 j-glow-primary text-right space-y-3">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <p className="font-bold text-sm">{current.query}</p>
          {current.match ? (
            <p className="text-xs text-muted-foreground">
              התאמה: {current.match.artist} — {current.match.song_name}
            </p>
          ) : (
            <p className="text-xs text-destructive">לא נמצאה התאמה אוטומטית</p>
          )}
        </div>
      </div>
      <div className="flex gap-3 justify-center pb-2">
        <Button
          variant="outline"
          size="lg"
          className="rounded-full h-14 w-14 p-0 border-destructive/40"
          onClick={() => {
            onSkip(current);
            setIndex((i) => i + 1);
          }}
          aria-label="דלג"
        >
          <X className="h-6 w-6 text-destructive" />
        </Button>
        <Button
          size="lg"
          className="rounded-full h-14 w-14 p-0"
          onClick={() => {
            onApprove(current);
            setIndex((i) => i + 1);
          }}
          aria-label="אשר"
        >
          <CheckCircle2 className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
