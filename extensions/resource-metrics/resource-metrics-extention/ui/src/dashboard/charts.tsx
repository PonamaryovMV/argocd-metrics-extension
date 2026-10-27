// Lightweight SVG charts: smooth lines, stacked bars, sparklines, gauge, donut.
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { formatAxis, formatTime, formatValue, niceMax, Point, Series } from "./data";

export interface Marker {
  t: number;
  label: string; // short revision shown on the chart
  title: string; // full text for the tooltip
}

let uidCounter = 0;
const useUid = (prefix: string) => {
  const ref = useRef<string>("");
  if (!ref.current) ref.current = `${prefix}${++uidCounter}`;
  return ref.current;
};

/** Width of a container, kept up to date with ResizeObserver. */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    const RO = (window as any).ResizeObserver;
    if (RO) {
      const ro = new RO(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return [ref, width];
}

/** Monotone cubic interpolation (Fritsch–Carlson): smooth, but never overshoots the data. */
export function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 0) return "";
  const f = (v: number) => v.toFixed(2);
  if (n === 1) return `M${f(pts[0].x)},${f(pts[0].y)}`;
  if (n === 2) return `M${f(pts[0].x)},${f(pts[0].y)}L${f(pts[1].x)},${f(pts[1].y)}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x || 1e-6;
    m[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${f(pts[i].x + h)},${f(pts[i].y + t[i] * h)} ${f(pts[i + 1].x - h)},${f(pts[i + 1].y - t[i + 1] * h)} ${f(
      pts[i + 1].x
    )},${f(pts[i + 1].y)}`;
  }
  return d;
}

interface TooltipRow {
  color: string;
  name: string;
  value: string;
  dashed?: boolean;
}

const Tooltip = ({ x, width, label, rows, note }: { x: number; width: number; label: string; rows: TooltipRow[]; note?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(160);
  useEffect(() => {
    if (ref.current) setW(ref.current.offsetWidth);
  });
  const left = Math.max(w / 2 + 4, Math.min(width - w / 2 - 4, x));
  return (
    <div className="mx-tooltip" ref={ref} style={{ left }}>
      <div className="mx-tooltip__label">{label}</div>
      {rows.map((r, i) => (
        <div className="mx-tooltip__row" key={i}>
          <span className={`mx-tooltip__swatch${r.dashed ? " is-dashed" : ""}`} style={{ background: r.dashed ? "transparent" : r.color, borderColor: r.color }} />
          <span className="mx-tooltip__name">{r.name}</span>
          <span className="mx-tooltip__val">{r.value}</span>
        </div>
      ))}
      {note && <div className="mx-tooltip__note">{note}</div>}
    </div>
  );
};

const PAD = { l: 52, r: 14, t: 16, b: 26 };

function xTicks(start: number, end: number, count = 5): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(start + ((end - start) * i) / (count - 1));
  return out;
}

function nearestMarker(markers: Marker[], t: number, tolerance: number): Marker | undefined {
  let best: Marker | undefined;
  let dist = Infinity;
  for (const mk of markers) {
    const d = Math.abs(mk.t - t);
    if (d <= tolerance && d < dist) {
      best = mk;
      dist = d;
    }
  }
  return best;
}

const Axes = ({
  width,
  height,
  yMax,
  unit,
  start,
  end,
}: {
  width: number;
  height: number;
  yMax: number;
  unit?: string;
  start: number;
  end: number;
}) => {
  const innerW = width - PAD.l - PAD.r;
  const innerH = height - PAD.t - PAD.b;
  const x = (t: number) => PAD.l + ((t - start) / (end - start)) * innerW;
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => {
        const y = PAD.t + (innerH * i) / 4;
        const v = yMax - (yMax * i) / 4;
        return (
          <g key={i}>
            <line x1={PAD.l} x2={width - PAD.r} y1={y} y2={y} className={i === 4 ? "mx-axis-base" : "mx-gridline"} />
            <text x={PAD.l - 8} y={y + 3.5} textAnchor="end" className="mx-axis-label">
              {formatAxis(v, unit)}
            </text>
          </g>
        );
      })}
      {xTicks(start, end).map((t, i, arr) => (
        <text
          key={i}
          x={x(t)}
          y={height - 6}
          textAnchor={i === 0 ? "start" : i === arr.length - 1 ? "end" : "middle"}
          className="mx-axis-label"
        >
          {formatTime(t)}
        </text>
      ))}
    </g>
  );
};

const MarkerLayer = ({
  markers,
  x,
  top,
  bottom,
}: {
  markers: Marker[];
  x: (t: number) => number;
  top: number;
  bottom: number;
}) => (
  <g>
    {markers.map((mk, i) => {
      const mx = x(mk.t);
      const w = Math.max(48, mk.label.length * 6.6 + 12);
      return (
        <g key={i} className="mx-marker">
          <title>{mk.title}</title>
          <line x1={mx} x2={mx} y1={top} y2={bottom} />
          <rect x={mx - w / 2} y={top - 13} width={w} height={15} rx={4} />
          <text x={mx} y={top - 2.5} textAnchor="middle">
            {mk.label}
          </text>
        </g>
      );
    })}
  </g>
);

export interface LineChartProps {
  series: Series[];
  thresholds?: Series[];
  markers?: Marker[];
  unit?: string;
  height?: number;
  start: number;
  end: number;
  area?: boolean;
  ariaLabel?: string;
}

export const LineChart = ({ series, thresholds = [], markers = [], unit, height = 220, start, end, area, ariaLabel }: LineChartProps) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hoverT, setHoverT] = useState<number | null>(null);
  const gid = useUid("mxg");

  const all = series.concat(thresholds);
  let maxV = 0;
  for (const s of all) for (const p of s.points) if (p.v > maxV) maxV = p.v;
  const yMax = niceMax(maxV * 1.08);
  const innerW = Math.max(10, width - PAD.l - PAD.r);
  const innerH = height - PAD.t - PAD.b;
  const x = (t: number) => PAD.l + ((t - start) / Math.max(1, end - start)) * innerW;
  const y = (v: number) => PAD.t + innerH - (v / yMax) * innerH;

  // Timestamps of the densest series drive the hover cursor.
  const timeline = series.reduce<Point[]>((acc, s) => (s.points.length > acc.length ? s.points : acc), []).map((p) => p.t);
  const step = timeline.length > 1 ? (timeline[timeline.length - 1] - timeline[0]) / (timeline.length - 1) : 60000;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!timeline.length) return;
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const t = start + ((e.clientX - rect.left) / rect.width) * (end - start);
    let best = timeline[0];
    for (const tt of timeline) if (Math.abs(tt - t) < Math.abs(best - t)) best = tt;
    setHoverT(best);
  };

  const valueAt = (s: Series, t: number) => {
    let best: Point | undefined;
    for (const p of s.points) if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
    return best && Math.abs(best.t - t) <= step ? best : undefined;
  };

  const visibleMarkers = markers.filter((m) => m.t >= start && m.t <= end);

  return (
    <div className="mx-chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${gid}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <Axes width={width} height={height} yMax={yMax} unit={unit} start={start} end={end} />
          {visibleMarkers.length > 0 && (
            <rect
              x={x(visibleMarkers[visibleMarkers.length - 1].t)}
              y={PAD.t}
              width={Math.max(0, x(end) - x(visibleMarkers[visibleMarkers.length - 1].t))}
              height={innerH}
              className="mx-after-sync"
            />
          )}
          {area &&
            series.map((s, i) => {
              const pts = s.points.map((p) => ({ x: x(p.t), y: y(p.v) }));
              if (pts.length < 2) return null;
              const base = PAD.t + innerH;
              const d = `${monotonePath(pts)}L${pts[pts.length - 1].x.toFixed(2)},${base}L${pts[0].x.toFixed(2)},${base}Z`;
              return <path key={i} d={d} fill={`url(#${gid}-${i})`} />;
            })}
          {thresholds.map((s, i) => (
            <path
              key={"th" + i}
              d={monotonePath(s.points.map((p) => ({ x: x(p.t), y: y(p.v) })))}
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              strokeDasharray={s.dashed || "5 4"}
            />
          ))}
          {series.map((s, i) => (
            <path
              key={i}
              className="mx-line"
              d={monotonePath(s.points.map((p) => ({ x: x(p.t), y: y(p.v) })))}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          <MarkerLayer markers={visibleMarkers} x={x} top={PAD.t} bottom={PAD.t + innerH} />
          {hoverT !== null && (
            <g pointerEvents="none">
              <line x1={x(hoverT)} x2={x(hoverT)} y1={PAD.t} y2={PAD.t + innerH} className="mx-cursor" />
              {series.map((s, i) => {
                const p = valueAt(s, hoverT);
                return p ? <circle key={i} cx={x(p.t)} cy={y(p.v)} r={4} fill="#fff" stroke={s.color} strokeWidth={2} /> : null;
              })}
            </g>
          )}
          <rect
            x={PAD.l}
            y={PAD.t}
            width={innerW}
            height={innerH}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseMove={onMove}
            onMouseLeave={() => setHoverT(null)}
          />
        </svg>
      )}
      {hoverT !== null && width > 0 && (
        <Tooltip
          x={x(hoverT)}
          width={width}
          label={formatTime(hoverT)}
          rows={series
            .map((s) => ({ s, p: valueAt(s, hoverT) }))
            .filter((r) => r.p)
            .slice(0, 12)
            .map((r) => ({ color: r.s.color, name: r.s.name, value: formatValue(r.p!.v, unit) }))
            .concat(
              thresholds
                .map((s) => ({ s, p: valueAt(s, hoverT) }))
                .filter((r) => r.p)
                .map((r) => ({ color: r.s.color, name: r.s.name, value: formatValue(r.p!.v, unit), dashed: true }))
            )}
          note={(() => {
            const mk = nearestMarker(visibleMarkers, hoverT, step);
            return mk ? mk.title : undefined;
          })()}
        />
      )}
    </div>
  );
};

export const BarChart = ({ series, markers = [], unit, height = 220, start, end, ariaLabel }: LineChartProps) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  // Union of timestamps, grouped into at most 48 buckets (average per bucket).
  const times = Array.from(new Set(series.reduce<number[]>((acc, s) => acc.concat(s.points.map((p) => p.t)), []))).sort((a, b) => a - b);
  const bucketCount = Math.min(48, times.length);
  const per = bucketCount ? Math.ceil(times.length / bucketCount) : 1;
  const buckets: { t0: number; t1: number; values: number[] }[] = [];
  for (let i = 0; i < times.length; i += per) {
    const ts = times.slice(i, i + per);
    const values = series.map((s) => {
      const pts = s.points.filter((p) => p.t >= ts[0] && p.t <= ts[ts.length - 1]);
      return pts.length ? pts.reduce((a, p) => a + p.v, 0) / pts.length : 0;
    });
    buckets.push({ t0: ts[0], t1: ts[ts.length - 1], values });
  }
  const maxTotal = buckets.reduce((m, b) => Math.max(m, b.values.reduce((a, v) => a + v, 0)), 0);
  const yMax = niceMax(maxTotal * 1.08);
  const innerW = Math.max(10, width - PAD.l - PAD.r);
  const innerH = height - PAD.t - PAD.b;
  const x = (t: number) => PAD.l + ((t - start) / Math.max(1, end - start)) * innerW;
  const y = (v: number) => PAD.t + innerH - (v / yMax) * innerH;
  const slot = buckets.length ? innerW / buckets.length : innerW;
  const barW = Math.max(2, slot * 0.68);
  const visibleMarkers = markers.filter((m) => m.t >= start && m.t <= end);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * buckets.length);
    setHover(Math.max(0, Math.min(buckets.length - 1, i)));
  };

  return (
    <div className="mx-chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <Axes width={width} height={height} yMax={yMax} unit={unit} start={start} end={end} />
          {buckets.map((b, i) => {
            const cx = PAD.l + slot * (i + 0.5);
            let acc = 0;
            return (
              <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
                {series.map((s, k) => {
                  const v = b.values[k];
                  const y0 = y(acc);
                  acc += v;
                  const y1 = y(acc);
                  const h = Math.max(0, y0 - y1);
                  return h > 0 ? <rect key={k} x={cx - barW / 2} y={y1} width={barW} height={h} fill={s.color} rx={k === 0 ? 1.5 : 0} /> : null;
                })}
              </g>
            );
          })}
          <MarkerLayer markers={visibleMarkers} x={x} top={PAD.t} bottom={PAD.t + innerH} />
          <rect
            x={PAD.l}
            y={PAD.t}
            width={innerW}
            height={innerH}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover !== null && buckets[hover] && width > 0 && (
        <Tooltip
          x={PAD.l + slot * (hover + 0.5)}
          width={width}
          label={
            buckets[hover].t0 === buckets[hover].t1
              ? formatTime(buckets[hover].t0)
              : `${formatTime(buckets[hover].t0)}–${formatTime(buckets[hover].t1)}`
          }
          rows={series
            .map((s, k) => ({ color: s.color, name: s.name, value: formatValue(buckets[hover].values[k], unit) }))
            .reverse()
            .concat([{ color: "transparent", name: "Всего", value: formatValue(buckets[hover].values.reduce((a, v) => a + v, 0), unit) }])}
        />
      )}
    </div>
  );
};

export const Sparkline = ({ points, color, height = 32 }: { points: Point[]; color: string; height?: number }) => {
  const gid = useUid("mxs");
  if (points.length < 2) return <div style={{ height }} />;
  const W = 200;
  const H = 40;
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  const range = max - min || 1;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const pts = points.map((p) => ({ x: ((p.t - t0) / Math.max(1, t1 - t0)) * W, y: H - 4 - ((p.v - min) / range) * (H - 8) }));
  const line = monotonePath(pts);
  return (
    <svg className="mx-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
};

/** 270° arc gauge, value in percent (0..100+). */
export const Gauge = ({ percent, caption }: { percent: number | null; caption: string }) => {
  const gid = useUid("mxgauge");
  const arc = 367.6; // 0.75 × 2πr, r = 78
  const full = 490.1;
  const p = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <svg className="mx-gauge" viewBox="0 0 240 170" role="img" aria-label={`${caption}: ${percent === null ? "нет данных" : Math.round(percent) + "%"}`}>
      <defs>
        <linearGradient id={gid} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#18A058" />
          <stop offset="55%" stopColor="#F08A24" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
      </defs>
      <circle cx="120" cy="105" r="78" fill="none" stroke="#EEF1F5" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${arc} ${full}`} transform="rotate(135 120 105)" />
      {percent !== null && (
        <circle
          className="mx-gauge__value"
          cx="120"
          cy="105"
          r="78"
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(arc * p) / 100} ${full}`}
          transform="rotate(135 120 105)"
        />
      )}
      <text x="120" y="102" textAnchor="middle" className="mx-gauge__num">
        {percent === null ? "—" : Math.round(percent)}
        {percent !== null && (
          <tspan className="mx-gauge__pct" dx="2">
            %
          </tspan>
        )}
      </text>
      <text x="120" y="122" textAnchor="middle" className="mx-gauge__cap">
        {caption.toUpperCase()}
      </text>
      <text x="46" y="160" textAnchor="middle" className="mx-gauge__tick">
        0%
      </text>
      <text x="194" y="160" textAnchor="middle" className="mx-gauge__tick">
        100%
      </text>
    </svg>
  );
};

export const Donut = ({ items, unit }: { items: { name: string; color: string; value: number }[]; unit?: string }) => {
  const total = items.reduce((a, i) => a + Math.max(0, i.value), 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="mx-donut">
      <svg viewBox="0 0 140 140" width={140} height={140} role="img" aria-label="Распределение">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#EEF1F5" strokeWidth="18" />
        {total > 0 &&
          items.map((it, i) => {
            const len = (Math.max(0, it.value) / total) * c;
            const el = (
              <circle
                key={i}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={it.color}
                strokeWidth="18"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <ul className="mx-donut__legend">
        {items.map((it, i) => (
          <li key={i}>
            <span className="mx-swatch mx-swatch--block" style={{ background: it.color }} />
            <span className="mx-donut__name">{it.name}</span>
            <b>{formatValue(it.value, unit)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
};
