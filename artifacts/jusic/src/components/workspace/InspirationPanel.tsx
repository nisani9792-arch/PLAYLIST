import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { TopicChip } from '@/components/ui/topic-chip';
import { VibeBadge } from '@/components/ui/vibe-badge';
import { fetchSuggestions } from '@/lib/memory-api';
import { fadeUpVariants, staggerContainer } from '@/lib/motion-presets';
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
        'flex flex-col min-h-0 j-glass-panel j-gradient-border rounded-[1.35rem] overflow-hidden h-full',
        className,
      )}
      aria-label="השראה"
    >
      <div className="shrink-0 px-4 py-3.5 border-b border-border/50 bg-gradient-to-l from-primary/8 via-transparent to-[hsl(var(--mesh-grey)/0.05)] shadow-sm">
        <div className="flex items-center gap-2">
          <div className="grid place-items-center h-8 w-8 rounded-full bg-primary/10 text-primary">
            <Lightbulb className="h-4 w-4" />
          </div>
          <h2 className="font-display text-sm font-bold tracking-tight">השראה חכמה</h2>
        </div>
        {styleNotes ? (
          <p className="text-[10px] text-secondary mt-1.5 leading-snug">{styleNotes}</p>
        ) : null}
      </div>

      <motion.div
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 custom-scrollbar"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {parasha ? (
          <motion.div variants={fadeUpVariants}>
            <TopicChip
              title={parasha.title}
              description={parasha.description}
              estimatedCount={parasha.estimatedCount}
              vibe="פרשה"
              onClick={() => onPickTopic('פרשת השבוע')}
              className="border-amber-400/25 bg-gradient-to-br from-amber-50/70 to-orange-50/40 dark:from-amber-950/25 dark:to-orange-950/10"
            />
          </motion.div>
        ) : null}

        {topics.map((topic) => (
          <motion.div key={topic.id} variants={fadeUpVariants}>
            <TopicChip
              title={topic.title}
              description={topic.description}
              estimatedCount={topic.estimatedCount}
              vibe={topic.vibe ? undefined : undefined}
              onClick={() => onPickTopic(topic.title)}
            />
          </motion.div>
        ))}
      </motion.div>

      <div className="shrink-0 px-3 py-2.5 border-t border-border/35 text-[10px] text-secondary flex flex-wrap gap-1.5 bg-card/40">
        <VibeBadge vibe="quiet" />
        <VibeBadge vibe="celebratory" />
        <VibeBadge vibe="emotional" />
      </div>
    </aside>
  );
}
