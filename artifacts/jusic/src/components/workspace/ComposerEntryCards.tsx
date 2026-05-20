import { cn } from '@/lib/utils';
import { BookOpen, ClipboardList, Sparkles } from 'lucide-react';

const CARDS = [
  {
    id: 'list',
    title: 'הדבק רשימה',
    description: 'שורה לכל שיר — אמן ושם',
    icon: ClipboardList,
    example: 'יניב בן משיח - שבת שלום',
  },
  {
    id: 'parasha',
    title: 'פרשת שבוע',
    description: 'שירים מ-PSH + התאמה במאגר',
    icon: BookOpen,
    example: 'פרשת נשא',
  },
  {
    id: 'ai',
    title: 'תאר נושא (AI)',
    description: '20–50 שירים לפי נושא',
    icon: Sparkles,
    example: 'שירי אמונה לפני חתונה',
  },
] as const;

export function ComposerEntryCards({
  onPick,
  className,
}: {
  onPick: (id: (typeof CARDS)[number]['id']) => void;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-3', className)}>
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onPick(card.id)}
            className="text-right rounded-xl border border-border/70 bg-card/90 p-3 hover:border-primary/35 hover:bg-primary/5 transition-colors"
          >
            <Icon className="h-4 w-4 text-primary mb-2" />
            <p className="text-xs font-bold text-foreground">{card.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{card.description}</p>
            <p className="text-[10px] text-primary/80 mt-2 font-medium truncate" dir="rtl">
              {card.example}
            </p>
          </button>
        );
      })}
    </div>
  );
}
