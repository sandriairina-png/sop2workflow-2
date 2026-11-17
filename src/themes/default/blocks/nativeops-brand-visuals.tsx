import { cn } from '@/shared/lib/utils';

type VisualProps = { className?: string };

const lineProps = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

export function NativeOpsHeroMark({ className }: VisualProps) {
  return (
    <svg
      viewBox="0 0 760 360"
      className={cn('nativeops-hero-mark', className)}
      aria-hidden="true"
      focusable="false"
    >
      <g className="nativeops-vector-orbit" opacity="0.62">
        <ellipse
          cx="380"
          cy="180"
          rx="282"
          ry="126"
          stroke="currentColor"
          strokeWidth="1"
          {...lineProps}
        />
        <ellipse
          cx="380"
          cy="180"
          rx="214"
          ry="92"
          stroke="currentColor"
          strokeWidth="1"
          {...lineProps}
        />
      </g>

      <g className="nativeops-vector-line" color="rgba(255,255,255,.38)">
        <path d="M120 180H258" strokeWidth="1.25" {...lineProps} />
        <path d="M502 180H640" strokeWidth="1.25" {...lineProps} />
        <path d="M380 54V118" strokeWidth="1.25" {...lineProps} />
        <path d="M380 242V306" strokeWidth="1.25" {...lineProps} />
        <path d="M286 132L210 88" strokeWidth="1.25" {...lineProps} />
        <path d="M474 228L550 272" strokeWidth="1.25" {...lineProps} />
      </g>

      <g className="nativeops-vector-core">
        <rect
          x="258"
          y="118"
          width="244"
          height="124"
          rx="38"
          fill="rgba(10,11,15,.88)"
          stroke="rgba(255,255,255,.42)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M314 210V150L380 210V150L446 210V150"
          stroke="#f8f7f4"
          strokeWidth="7"
          {...lineProps}
        />
        <circle cx="380" cy="180" r="8" fill="#7cff67" />
      </g>

      <g className="nativeops-vector-nodes">
        {[
          { cx: 100, cy: 180, fill: '#7cff67' },
          { cx: 660, cy: 180, fill: '#f8f7f4' },
          { cx: 380, cy: 42, fill: '#f8f7f4' },
          { cx: 380, cy: 318, fill: '#7cff67' },
          { cx: 194, cy: 78, fill: '#a99cff' },
          { cx: 566, cy: 282, fill: '#a99cff' },
        ].map(({ cx, cy, fill }, index) => (
          <g key={index} style={{ animationDelay: `${index * -0.45}s` }}>
            <circle
              cx={cx}
              cy={cy}
              r="18"
              fill="rgba(9,10,13,.86)"
              stroke="rgba(255,255,255,.32)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={cx} cy={cy} r="4" fill={fill} />
          </g>
        ))}
      </g>
      <circle
        className="nativeops-vector-pulse"
        cx="100"
        cy="180"
        r="7"
        fill="#7cff67"
      />
    </svg>
  );
}

export function NativeOpsSignalIcon({
  variant,
  className,
}: VisualProps & { variant: number }) {
  const content = [
    <>
      <path d="M8 24H18L24 14L30 24H40" {...lineProps} />
      <circle cx="24" cy="14" r="3" fill="#7cff67" />
    </>,
    <>
      <circle cx="14" cy="24" r="5" {...lineProps} />
      <circle cx="34" cy="24" r="5" {...lineProps} />
      <path d="M19 24H29M14 19V11H34V19" {...lineProps} />
      <circle cx="24" cy="11" r="3" fill="#a99cff" />
    </>,
    <>
      <path
        d="M24 7L38 13V22C38 31 32 38 24 41C16 38 10 31 10 22V13L24 7Z"
        {...lineProps}
      />
      <path d="M18 24L22 28L31 19" {...lineProps} />
    </>,
  ][variant % 3];

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.6" color="currentColor">
        {content}
      </g>
    </svg>
  );
}

export function NativeOpsJourney({ className }: VisualProps) {
  return (
    <svg
      viewBox="0 0 1200 210"
      className={cn('nativeops-journey', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M92 105C190 105 190 42 292 42S394 168 496 168S598 42 700 42S802 168 904 168S1006 105 1108 105"
        stroke="rgba(255,255,255,.18)"
        strokeWidth="1.5"
        {...lineProps}
      />
      <path
        className="nativeops-journey-trace"
        d="M92 105C190 105 190 42 292 42S394 168 496 168S598 42 700 42S802 168 904 168S1006 105 1108 105"
        stroke="#7cff67"
        strokeWidth="2"
        pathLength="1"
        {...lineProps}
      />
      {[92, 394, 700, 1006].map((cx, index) => {
        const cy = [105, 105, 42, 105][index];
        return (
          <g key={cx} className="nativeops-journey-node">
            <circle
              cx={cx}
              cy={cy}
              r="24"
              fill="#0d0e12"
              stroke="rgba(255,255,255,.28)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={cx}
              cy={cy}
              r={index === 3 ? 7 : 4}
              fill={index === 3 ? '#7cff67' : '#f8f7f4'}
            />
          </g>
        );
      })}
    </svg>
  );
}

export function NativeOpsSystemMap({ className }: VisualProps) {
  const modules = [
    { x: 54, y: 48, w: 176, h: 86, accent: '#f8f7f4' },
    { x: 286, y: 24, w: 190, h: 110, accent: '#7cff67' },
    { x: 530, y: 62, w: 176, h: 86, accent: '#a99cff' },
    { x: 98, y: 230, w: 190, h: 106, accent: '#a99cff' },
    { x: 352, y: 218, w: 176, h: 86, accent: '#f8f7f4' },
    { x: 588, y: 244, w: 176, h: 106, accent: '#7cff67' },
  ];
  return (
    <svg
      viewBox="0 0 820 390"
      className={cn('nativeops-system-map', className)}
      aria-hidden="true"
      focusable="false"
    >
      <g color="rgba(255,255,255,.22)" stroke="currentColor" strokeWidth="1.2">
        <path
          d="M230 90H286M476 82L530 105M188 134L193 230M622 148L676 244M288 281H352M528 261L588 286"
          {...lineProps}
        />
        <path d="M381 134V176H440V218M193 176H676" {...lineProps} />
      </g>
      {modules.map((module, index) => (
        <g
          key={`${module.x}-${module.y}`}
          className="nativeops-system-module"
          style={{ animationDelay: `${index * 90}ms` }}
        >
          <rect
            x={module.x}
            y={module.y}
            width={module.w}
            height={module.h}
            rx="18"
            fill="rgba(13,14,18,.92)"
            stroke="rgba(255,255,255,.18)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={module.x + 24}
            cy={module.y + 24}
            r="5"
            fill={module.accent}
          />
          <path
            d={`M${module.x + 24} ${module.y + 48}H${module.x + module.w - 24}`}
            stroke="rgba(255,255,255,.3)"
            strokeWidth="1"
            {...lineProps}
          />
          <path
            d={`M${module.x + 24} ${module.y + 64}H${module.x + module.w * 0.66}`}
            stroke="rgba(255,255,255,.12)"
            strokeWidth="1"
            {...lineProps}
          />
        </g>
      ))}
      <circle
        className="nativeops-system-pulse"
        cx="193"
        cy="176"
        r="5"
        fill="#7cff67"
      />
    </svg>
  );
}

export function NativeOpsClosingMark({ className }: VisualProps) {
  return (
    <svg
      viewBox="0 0 720 220"
      className={cn('nativeops-closing-mark', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M44 110H220L280 48L360 172L440 48L500 110H676"
        stroke="rgba(255,255,255,.34)"
        strokeWidth="1.4"
        {...lineProps}
      />
      <path
        className="nativeops-closing-trace"
        d="M44 110H220L280 48L360 172L440 48L500 110H676"
        stroke="#7cff67"
        strokeWidth="2"
        pathLength="1"
        {...lineProps}
      />
      <circle cx="44" cy="110" r="7" fill="#f8f7f4" />
      <circle cx="676" cy="110" r="9" fill="#7cff67" />
    </svg>
  );
}
