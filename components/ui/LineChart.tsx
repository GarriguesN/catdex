interface LineChartProps {
  /** Y values, evenly spaced */
  values: number[];
  /** Labels shown under the chart (subset is fine) */
  labels?: string[];
  height?: number;
}

/** Minimal orange line chart with soft area fill — no axes, no grid noise. */
export function LineChart({ values, labels = [], height = 120 }: LineChartProps) {
  const w = 320;
  const h = height;
  const pad = 6;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });

  // Smooth path via Catmull-Rom → bezier
  let d = "";
  if (pts.length > 0) {
    d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
    }
  }

  const area = d ? `${d} L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z` : "";

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF8A26" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#FF8A26" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <path d={area} fill="url(#chart-fill)" />}
        {d && (
          <path d={d} fill="none" stroke="#FF8A26" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {pts.length > 0 && (
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="#FF8A26" stroke="#FFF" strokeWidth="2" />
        )}
      </svg>
      {labels.length > 0 && (
        <div className="flex justify-between mt-1.5 px-1">
          {labels.map((l, i) => (
            <span key={i} className="text-[0.625rem] text-catdex-gray-light">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
