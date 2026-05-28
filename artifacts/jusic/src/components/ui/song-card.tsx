import type { MsHit } from '@/lib/meilisearch';
import { TrackRow } from '@/components/workspace/TrackRow';
import { StatusChip } from './status-chip';

/** @deprecated Prefer TrackRow for workspace lists. */
export function SongCard({
  song,
  index,
  blocked,
  blockReason,
  onRemove,
  className,
}: {
  song: MsHit;
  index?: number;
  blocked?: boolean;
  blockReason?: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <TrackRow
      song={song}
      index={index}
      showIndex={index != null}
      showThumb={false}
      statusLabel={blocked ? 'חסום' : undefined}
      statusTone="danger"
      onRemove={onRemove}
      className={className}
      trailing={
        blockReason ? (
          <StatusChip tone="danger" className="hidden sm:inline-flex">
            {blockReason.slice(0, 12)}
          </StatusChip>
        ) : null
      }
    />
  );
}
