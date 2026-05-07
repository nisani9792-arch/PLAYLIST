import { getHealthCheckQueryKey, useHealthCheck } from '@workspace/api-client-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function ApiStatusIndicator() {
  const { data, isError, isPending } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 30_000,
      retry: 1,
      staleTime: 15_000,
    },
  });

  const ok = Boolean(!isError && !isPending && data?.status === 'ok');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-default select-none"
          data-testid="api-status-indicator"
        >
          <span
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              ok && 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
              !ok && isPending && 'bg-amber-400 animate-pulse',
              !ok && !isPending && 'bg-red-500',
            )}
          />
          <span className="hidden sm:inline font-medium tracking-wide">API</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        {ok && 'שרת ה-API זמין — חיפוש ו-AI יכולים לעבוד.'}
        {isPending && !ok && 'בודק חיבור לשרת…'}
        {!isPending && !ok && 'אין חיבור לשרת ה-API. ודא שהשרת רץ ושהפרוקסי ל-/api פעיל.'}
      </TooltipContent>
    </Tooltip>
  );
}
