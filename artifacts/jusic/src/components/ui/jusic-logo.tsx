import { cn } from '@/lib/utils';

type JusicLogoProps = {
  size?: number;
  className?: string;
  showWordmark?: boolean;
  animated?: boolean;
};

export function JusicLogo({
  size = 40,
  className,
  showWordmark = false,
  animated = true,
}: JusicLogoProps) {
  const markSize = showWordmark ? size : size;

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden={showWordmark ? undefined : true}
        role={showWordmark ? 'img' : undefined}
        aria-label={showWordmark ? 'Jusic' : undefined}
        className={cn('shrink-0', animated && 'j-logo-float')}
      >
        <defs>
          <linearGradient id="jusic-grad-a" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6EA8FE" />
            <stop offset="0.45" stopColor="#A78BFA" />
            <stop offset="1" stopColor="#F472B6" />
          </linearGradient>
          <linearGradient id="jusic-grad-b" x1="20" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="1" stopColor="#818CF8" />
          </linearGradient>
          <radialGradient
            id="jusic-glow"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(32 32) rotate(90) scale(28)"
          >
            <stop stopColor="#818CF8" stopOpacity="0.35" />
            <stop offset="1" stopColor="#818CF8" stopOpacity="0" />
          </radialGradient>
          <filter id="jusic-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx="32" cy="32" r="30" fill="url(#jusic-glow)" opacity="0.55" />
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="18"
          fill="hsl(225 45% 99% / 0.72)"
          stroke="url(#jusic-grad-a)"
          strokeWidth="1.25"
          strokeOpacity="0.55"
        />

        {/* Abstract waveform + J curve */}
        <path
          d="M18 44 C18 28 22 20 32 20 C38 20 42 24 42 30 C42 36 38 40 32 40 C28 40 26 38 26 36"
          stroke="url(#jusic-grad-a)"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#jusic-soft-glow)"
        />
        <path
          d="M46 18 V46"
          stroke="url(#jusic-grad-b)"
          strokeWidth="4.5"
          strokeLinecap="round"
          filter="url(#jusic-soft-glow)"
        />
        <circle cx="46" cy="46" r="3.5" fill="url(#jusic-grad-b)" />
        <path
          d="M14 36 C20 32 24 28 30 26 C36 24 40 22 44 18"
          stroke="url(#jusic-grad-b)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>

      {showWordmark ? (
        <span className="font-display font-bold tracking-tight text-foreground leading-none">
          <span className="j-text-gradient text-[1.05em]">Jusic</span>
        </span>
      ) : null}
    </div>
  );
}
