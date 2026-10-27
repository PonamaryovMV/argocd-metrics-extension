// Turning Prometheus matrices into chart series, plus number/time formatting.
import type { Graph, GraphResult, PromSeries, ThresholdResult } from "./api";

export interface Point {
  t: number; // ms since epoch
  v: number;
}

export interface Series {
  name: string;
  color: string;
  points: Point[];
  dashed?: string; // stroke-dasharray for threshold lines
}

export const PALETTE = [
  "#2B6CD9",
  "#F08A24",
  "#0F8C84",
  "#7C3AED",
  "#C2410C",
  "#1E40AF",
  "#DB2777",
  "#65A30D",
  "#0891B2",
  "#A16207",
];

// Status-code classes get fixed colours so 2xx/4xx/5xx read the same everywhere.
const CODE_COLORS: Record<string, string> = { "1": "#A5B4C8", "2": "#93B8F0", "3": "#7DD3C0", "4": "#F5B041", "5": "#B42318" };

function codeColor(name: string): string | undefined {
  const m = /^([1-5])(\d\d|xx)$/i.exec(name.trim());
  return m ? CODE_COLORS[m[1]] : undefined;
}

export function seriesName(metric: Record<string, string>, groupBy?: string): string {
  if (groupBy && metric && typeof metric[groupBy] === "string") return metric[groupBy];
  const vals = Object.keys(metric || {})
    .filter((k) => k !== "__name__")
    .map((k) => metric[k]);
  return vals.length ? vals.join(":") : "value";
}

function toPoints(values: [number, string][]): Point[] {
  const out: Point[] = [];
  for (const [ts, raw] of values || []) {
    const v = parseFloat(raw);
    if (isFinite(v)) out.push({ t: ts * 1000, v });
  }
  return out;
}

export function toSeries(data: PromSeries[] | null | undefined, graph: Graph): Series[] {
  const colors = graph.colorSchemes && graph.colorSchemes.length ? graph.colorSchemes : PALETTE;
  const list = (data || [])
    .map((s) => ({ name: seriesName(s.metric, graph.metricName), points: toPoints(s.values) }))
    .filter((s) => s.points.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return list.map((s, i) => ({ ...s, color: codeColor(s.name) || colors[i % colors.length] }));
}

const THRESHOLD_STYLE: Record<string, { color: string; dashed: string }> = {
  limit: { color: "#B42318", dashed: "6 4" },
  request: { color: "#6B7280", dashed: "2 4" },
  requests: { color: "#6B7280", dashed: "2 4" },
};

/** One line per threshold: if a threshold returns several series (e.g. per pod), take the max at each timestamp. */
export function thresholdLines(thresholds: ThresholdResult[] | null | undefined): Series[] {
  return (thresholds || [])
    .map((th) => {
      const style = THRESHOLD_STYLE[(th.key || "").toLowerCase()] || { color: "#9CA3AF", dashed: "5 4" };
      const all = (th.data || []).map((s) => toPoints(s.values));
      return {
        name: th.name || th.key,
        color: th.color || style.color,
        dashed: style.dashed,
        points: combine(all, Math.max),
      };
    })
    .filter((s) => s.points.length > 0);
}

/** Merge several point lists on their timestamps with a reducer (sum, max…). */
export function combine(lists: Point[][], reducer: (a: number, b: number) => number): Point[] {
  const map = new Map<number, number>();
  for (const pts of lists) {
    for (const p of pts) {
      const prev = map.get(p.t);
      map.set(p.t, prev === undefined ? p.v : reducer(prev, p.v));
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ t, v }));
}

const add = (a: number, b: number) => a + b;

export interface StatValue {
  value: number | null;
  first: number | null;
  points: Point[];
  limit: number | null;
}

/** Stat tiles and gauges: sum of all series (e.g. CPU of every pod), limit = sum of the "limit" threshold (or the first one). */
export function statValue(result: GraphResult | undefined): StatValue {
  const series = (result?.data || []).map((s) => toPoints(s.values));
  const points = combine(series, add);
  const thresholds = result?.thresholds || [];
  const th = thresholds.find((t) => (t.key || "").toLowerCase() === "limit") || thresholds[0];
  let limit: number | null = null;
  if (th) {
    if (th.data && th.data.length) {
      const lp = combine(th.data.map((s) => toPoints(s.values)), add);
      limit = lp.length ? lp[lp.length - 1].v : null;
    }
    if (limit === null && th.value && isFinite(parseFloat(th.value))) limit = parseFloat(th.value);
  }
  return {
    value: points.length ? points[points.length - 1].v : null,
    first: points.length ? points[0].v : null,
    points,
    limit,
  };
}

export function lastValue(points: Point[]): number | null {
  return points.length ? points[points.length - 1].v : null;
}

// ---------- formatting ----------

function trim(n: number, digits: number): string {
  const s = n.toFixed(digits);
  return digits > 0 ? s.replace(/\.?0+$/, "") : s;
}

function smart(n: number): string {
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a >= 1e9) return trim(n / 1e9, 1) + "G";
  if (a >= 1e6) return trim(n / 1e6, 1) + "M";
  if (a >= 1e4) return trim(n / 1e3, 1) + "k";
  if (a >= 100) return Math.round(n).toString();
  if (a >= 10) return trim(n, 1);
  if (a >= 1) return trim(n, 2);
  return trim(n, 3);
}

/** Splits a value into the number and its unit so tiles can style them separately. */
export function formatParts(v: number | null | undefined, unit?: string): [string, string] {
  if (v === null || v === undefined || !isFinite(v)) return ["—", ""];
  const u = (unit || "").trim();
  if (/^(bytes|B)\/s$/i.test(u)) {
    const [n, base] = formatParts(v, "bytes");
    return [n, base + "/s"];
  }
  switch (u.toLowerCase()) {
    case "bytes":
    case "b": {
      const units = ["B", "KiB", "MiB", "GiB", "TiB"];
      let i = 0;
      let n = v;
      while (Math.abs(n) >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
      }
      return [trim(n, Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2), units[i]];
    }
    case "s":
    case "seconds":
      if (Math.abs(v) < 1) return [Math.round(v * 1000).toString(), "ms"];
      return [trim(v, 2), "s"];
    case "ms":
      return [Math.abs(v) >= 10 ? Math.round(v).toString() : trim(v, 1), "ms"];
    case "%":
      return [trim(v, Math.abs(v) < 1 ? 2 : 1), "%"];
    case "ratio":
      return [trim(v * 100, Math.abs(v) < 0.01 ? 2 : 1), "%"];
    default:
      return [smart(v), u];
  }
}

export function formatValue(v: number | null | undefined, unit?: string): string {
  const [n, u] = formatParts(v, unit);
  if (!u) return n;
  return u === "%" ? n + u : `${n} ${u}`;
}

/** Short axis label: no unit for plain numbers to keep the axis narrow. */
export function formatAxis(v: number, unit?: string): string {
  const [n, u] = formatParts(v, unit);
  if (!u) return n;
  if (u === "%" || u === "ms" || u === "s") return n + u;
  if (/B(\/s)?$/.test(u)) return `${n} ${u}`;
  return n;
}

const pad = (n: number) => (n < 10 ? "0" + n : "" + n);

export function formatTime(t: number, withSeconds = false): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}${withSeconds ? ":" + pad(d.getSeconds()) : ""}`;
}

export function formatDuration(d: string): string {
  const m = /^(\d+)([smhdw])$/.exec(d.trim());
  if (!m) return d;
  const names: Record<string, string> = { s: "с", m: "м", h: "ч", d: "д", w: "н" };
  return m[1] + names[m[2]];
}

export function parseDuration(d: string | undefined, fallbackMs: number): number {
  const m = /^(\d+)(ms|s|m|h|d|w)$/.exec((d || "").trim());
  if (!m) return fallbackMs;
  const mult: Record<string, number> = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };
  return parseInt(m[1], 10) * mult[m[2]];
}

export function formatAge(from: string | undefined, now: number): string {
  if (!from) return "—";
  const t = Date.parse(from);
  if (!isFinite(t)) return "—";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return s + "с";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "м";
  const h = Math.floor(m / 60);
  if (h < 48) return h + "ч";
  return Math.floor(h / 24) + "д";
}

/** "Nice" upper bound for an axis: 1, 2, 2.5, 5 × 10^k. */
export function niceMax(v: number): number {
  if (!isFinite(v) || v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * base >= v) return m * base;
  }
  return 10 * base;
}
