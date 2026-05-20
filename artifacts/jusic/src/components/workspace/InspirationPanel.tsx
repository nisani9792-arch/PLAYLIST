import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { TopicChip } from '@/components/ui/topic-chip';
import { VibeBadge } from '@/components/ui/vibe-badge';
import { fetchSuggestions } from '@/lib/memory-api';
import { cn } from '@/lib/utils';

export type TopicSuggestion = {
  id: string;
  title: string;
  description?: string;
  estimatedCount?: number;
  vibe?: string;
};

type InspirationPanelProps = {
  onPickTopic: (title: string) => void;
  className?: string;
};

export function InspirationPanel({ onPickTopic, className }: InspirationPanelProps) {
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [parasha, setParasha] = useState<TopicSuggestion | null>(null);
  const [styleNotes, setStyleNotes] = useState('');

  useEffect(() => {
    void fetchSuggestions().then((s) => {
      setTopics((s.topics as TopicSuggestion[] | undefined) ?? []);
      setParasha((s.parasha as TopicSuggestion | undefined) ?? null);
      setStyleNotes(s.styleNotes ?? '');
    });
  }, []);

  return (
    <aside
      className={cn(
        'flex flex-col min-h-0 bp-surface-card rounded-[1.25rem] overflow-hidden',
        className,
      )}
      aria-label="השראה"
    >
      <div className="shrink-0 px-4 py-3 border-b border-border/50 bg-gradient-to-l from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold">השראה חכמה</h2>
        </div>
        {styleNotes ? (
          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{styleNotes}</p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {parasha ? (
          <TopicChip
            title={parasha.title}
            description={parasha.description}
            estimatedCount={parasha.estimatedCount}
            vibe="פרשה"
            onClick={() => onPickTopic('פרשת השבוע')}
            className="border-amber-400/30 bg-amber-50/50 dark:bg-amber-950/20"
          />
        ) : null}

        {topics.map((topic) => (
          <TopicChip
            key={topic.id}
            title={topic.title}
            description={topic.description}
            estimatedCount={topic.estimatedCount}
            vibe={topic.vibe ? undefined : undefined}
            onClick={() => onPickTopic(topic.title)}
          />
        ))}
      </div>

      <div className="shrink-0 px-3 py-2 border-t border-border/40 text-[10px] text-muted-foreground flex flex-wrap gap-1">
        <VibeBadge vibe="quiet" />
        <VibeBadge vibe="celebratory" />
        <VibeBadge vibe="emotional" />
      </div>
    </aside>
  );
}
