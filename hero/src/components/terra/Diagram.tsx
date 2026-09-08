/**
 * Scroll-driven SVG diagrams. Each accepts `p` (0 -> 1 chapter progress)
 * and draws itself in as the chapter comes into view.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const ease = (n: number) => 1 - Math.pow(1 - clamp01(n), 3);

type Props = { kind: string; p: number };

const SOIL = "var(--soil)";
const FOLIAGE = "var(--foliage)";
const BONE = "var(--bone)";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 320 320" className="size-full overflow-visible">
      <defs>
        <linearGradient id="soilFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--soil)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--soil)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke={BONE} strokeOpacity="0.08" strokeWidth="1">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`h${i}`} x1="0" y1={40 + i * 60} x2="320" y2={40 + i * 60} />
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={`v${i}`} x1={40 + i * 60} y1="0" x2={40 + i * 60} y2="320" />
        ))}
      </g>
      {children}
    </svg>
  );
}

function Curve({ p }: { p: number }) {
  const d = "M20 270 C 90 265, 120 190, 160 150 S 250 70, 300 50";
  const e = ease(p);
  return (
    <Frame>
      <path d={`${d} L300 300 L20 300 Z`} fill="url(#soilFade)" opacity={e * 0.9} />
      <path
        d={d}
        fill="none"
        stroke={SOIL}
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - e}
      />
      {[0.25, 0.55, 0.85].map((t, i) => (
        <circle
          key={i}
          r="4"
          cx={20 + t * 280}
          cy={270 - Math.pow(t, 0.8) * 215}
          fill={SOIL}
          opacity={clamp01((e - t) * 6)}
        />
      ))}
    </Frame>
  );
}

function Provenance({ p }: { p: number }) {
  const e = ease(p);
  const rows = ["READING", "ESTIMATE", "GAP"];
  return (
    <Frame>
      {rows.map((r, i) => {
        const t = clamp01((e - i * 0.18) * 2.2);
        const y = 70 + i * 80;
        return (
          <g key={r} opacity={t}>
            <rect
              x="30"
              y={y}
              width={240 * t}
              height="46"
              rx="8"
              fill={i === 2 ? "transparent" : SOIL}
              fillOpacity={i === 0 ? 0.18 : 0.08}
              stroke={i === 2 ? FOLIAGE : SOIL}
              strokeOpacity="0.5"
              strokeDasharray={i === 2 ? "5 5" : undefined}
            />
            <text
              x="46"
              y={y + 29}
              fill={i === 2 ? FOLIAGE : BONE}
              fontSize="13"
              fontFamily="var(--font-mono)"
              letterSpacing="3"
              opacity={clamp01(t * 1.6 - 0.4)}
            >
              {r}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

function Bars({ p }: { p: number }) {
  const e = ease(p);
  const vals = [0.42, 0.66, 0.35, 0.82, 0.58, 0.94];
  return (
    <Frame>
      {vals.map((v, i) => {
        const t = clamp01((e - i * 0.08) * 2);
        const h = v * 220 * t;
        return (
          <rect
            key={i}
            x={34 + i * 44}
            y={280 - h}
            width="24"
            height={h}
            rx="4"
            fill={i === vals.length - 1 ? SOIL : FOLIAGE}
            fillOpacity={i === vals.length - 1 ? 0.95 : 0.45}
          />
        );
      })}
      <line x1="20" y1="280" x2="300" y2="280" stroke={BONE} strokeOpacity="0.2" />
      <line
        x1="20"
        y1={280 - 0.7 * 220}
        x2={20 + 280 * e}
        y2={280 - 0.7 * 220}
        stroke={SOIL}
        strokeDasharray="4 6"
        strokeOpacity="0.7"
      />
    </Frame>
  );
}

function Network({ p }: { p: number }) {
  const e = ease(p);
  const nodes = [
    [160, 160],
    [70, 80],
    [255, 95],
    [90, 245],
    [250, 240],
    [160, 40],
  ] as const;
  return (
    <Frame>
      {nodes.slice(1).map(([x, y], i) => {
        const t = clamp01((e - i * 0.12) * 2.4);
        return (
          <line
            key={i}
            x1="160"
            y1="160"
            x2={160 + (x - 160) * t}
            y2={160 + (y - 160) * t}
            stroke={SOIL}
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
        );
      })}
      {nodes.map(([x, y], i) => {
        const t = clamp01((e - i * 0.1) * 3);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={(i === 0 ? 16 : 9) * t} fill={i === 0 ? SOIL : FOLIAGE} />
            <circle
              cx={x}
              cy={y}
              r={(i === 0 ? 30 : 18) * t}
              fill="none"
              stroke={i === 0 ? SOIL : FOLIAGE}
              strokeOpacity="0.3"
            />
          </g>
        );
      })}
    </Frame>
  );
}

function Plots({ p }: { p: number }) {
  const e = ease(p);
  const cells = [
    [40, 60, 110, 90],
    [165, 60, 115, 60],
    [40, 165, 70, 100],
    [125, 135, 90, 130],
    [230, 135, 50, 130],
  ] as const;
  return (
    <Frame>
      {cells.map(([x, y, w, h], i) => {
        const t = clamp01((e - i * 0.13) * 2.4);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w * t}
            height={h * t}
            rx="4"
            fill={i === 1 ? SOIL : FOLIAGE}
            fillOpacity={i === 1 ? 0.22 : 0.1}
            stroke={i === 1 ? SOIL : FOLIAGE}
            strokeOpacity="0.6"
          />
        );
      })}
      <line
        x1="0"
        y1={40 + e * 240}
        x2="320"
        y2={40 + e * 240}
        stroke={SOIL}
        strokeOpacity="0.8"
      />
    </Frame>
  );
}

function Chat({ p }: { p: number }) {
  const e = ease(p);
  const msgs = [
    [40, 60, 170, 0],
    [110, 130, 170, 1],
    [40, 200, 200, 0],
  ] as const;
  return (
    <Frame>
      {msgs.map(([x, y, w, mine], i) => {
        const t = clamp01((e - i * 0.2) * 2.6);
        return (
          <g key={i} opacity={t} transform={`translate(0 ${(1 - t) * 14})`}>
            <rect
              x={x}
              y={y}
              width={w}
              height="52"
              rx="14"
              fill={mine ? SOIL : FOLIAGE}
              fillOpacity={mine ? 0.22 : 0.1}
              stroke={mine ? SOIL : FOLIAGE}
              strokeOpacity="0.45"
            />
            <rect x={x + 16} y={y + 16} width={w * 0.5} height="6" rx="3" fill={BONE} fillOpacity="0.4" />
            <rect x={x + 16} y={y + 30} width={w * 0.32} height="6" rx="3" fill={BONE} fillOpacity="0.22" />
          </g>
        );
      })}
    </Frame>
  );
}

function Cascade({ p }: { p: number }) {
  const e = ease(p);
  const leaves = [60, 110, 160, 210, 260];
  return (
    <Frame>
      <circle cx="160" cy="60" r={18 * ease(p * 2)} fill={FOLIAGE} />
      {leaves.map((x, i) => {
        const t = clamp01((e - 0.2 - i * 0.1) * 2.4);
        return (
          <g key={x}>
            <path
              d={`M160 78 C 160 150, ${x} 150, ${x} ${78 + (200 - 78) * t}`}
              fill="none"
              stroke={FOLIAGE}
              strokeOpacity="0.5"
              strokeWidth="1.5"
            />
            <rect
              x={x - 12}
              y={200}
              width="24"
              height={60 * t}
              rx="4"
              fill={FOLIAGE}
              fillOpacity={0.12 + i * 0.06}
              stroke={FOLIAGE}
              strokeOpacity="0.4"
            />
          </g>
        );
      })}
    </Frame>
  );
}

function Wave({ p }: { p: number }) {
  const e = ease(p);
  return (
    <Frame>
      {[0, 1, 2, 3].map((i) => {
        const t = clamp01((e - i * 0.12) * 2);
        return (
          <circle
            key={i}
            cx="160"
            cy="160"
            r={30 + i * 40 * t}
            fill="none"
            stroke={i % 2 ? SOIL : FOLIAGE}
            strokeOpacity={0.6 - i * 0.12}
            strokeWidth="1.5"
          />
        );
      })}
      <circle cx="160" cy="160" r={14 * ease(p * 2)} fill={SOIL} />
      {[-1, 1].map((s) => (
        <path
          key={s}
          d={`M160 160 q ${s * 70} -60 ${s * 120} -20`}
          fill="none"
          stroke={BONE}
          strokeOpacity="0.25"
          strokeDasharray="4 6"
          pathLength={1}
          strokeDashoffset={1 - e}
        />
      ))}
    </Frame>
  );
}

export function Diagram({ kind, p }: Props) {
  switch (kind) {
    case "curve":
      return <Curve p={p} />;
    case "provenance":
      return <Provenance p={p} />;
    case "bars":
      return <Bars p={p} />;
    case "network":
      return <Network p={p} />;
    case "plots":
      return <Plots p={p} />;
    case "chat":
      return <Chat p={p} />;
    case "cascade":
      return <Cascade p={p} />;
    default:
      return <Wave p={p} />;
  }
}
