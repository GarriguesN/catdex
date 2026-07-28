interface ProgressRingProps {
  /** 0–1 */
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Center label (e.g. "70%") */
  label?: string;
}

/** Orange circular progress indicator over a soft track. */
export function ProgressRing({ progress, size = 56, strokeWidth = 6, label }: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3EFE7" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#FF8A26"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      {label && (
        <span className="absolute text-[0.6875rem] font-bold text-catdex-text">{label}</span>
      )}
    </div>
  );
}
