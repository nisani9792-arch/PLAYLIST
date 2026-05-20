import { APP_LOGO_URL, APP_SHORT_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

type JusicLogoProps = {
  size?: number;
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  animated?: boolean;
  /** Premium rounded app-icon frame (header, settings) */
  framed?: boolean;
};

export function JusicLogo({
  size = 40,
  className,
  markClassName,
  showWordmark = false,
  animated = true,
  framed = false,
}: JusicLogoProps) {
  const mark = framed ? (
    <div
      className={cn('j-logo-mark', animated && 'j-logo-mark--float', markClassName)}
      style={markClassName ? undefined : { width: size, height: size }}
      aria-hidden
    >
      <img
        src={APP_LOGO_URL}
        alt=""
        className="j-logo-mark__img"
        decoding="async"
      />
    </div>
  ) : (
    <img
      src={APP_LOGO_URL}
      alt={APP_SHORT_NAME}
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', animated && 'j-logo-float')}
      decoding="async"
    />
  );

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <div className="relative shrink-0" role={framed ? 'img' : undefined} aria-label={framed ? APP_SHORT_NAME : undefined}>
        {mark}
      </div>
      {showWordmark ? (
        <span className="font-display font-bold tracking-tight text-foreground leading-none">
          <span className="j-text-gradient text-[1.05em]">{APP_SHORT_NAME}</span>
        </span>
      ) : null}
    </div>
  );
}
