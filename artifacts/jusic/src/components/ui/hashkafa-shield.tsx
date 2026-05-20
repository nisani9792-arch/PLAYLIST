import { Shield, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HashkafaShield({
  blocked,
  reason,
  className,
}: {
  blocked?: boolean;
  reason?: string;
  className?: string;
}) {
  if (blocked) {
    return (
      <span
        title={reason ?? 'חסום — hashkafa'}
        className={cn('text-destructive shrink-0', className)}
        aria-label={reason ?? 'חסום'}
      >
        <ShieldAlert className="h-4 w-4" />
      </span>
    );
  }

  return (
    <span className={cn('text-primary/40 shrink-0', className)} aria-hidden>
      <Shield className="h-3.5 w-3.5" />
    </span>
  );
}
