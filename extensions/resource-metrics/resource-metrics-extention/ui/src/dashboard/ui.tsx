// Small shared UI pieces.
import * as React from "react";
import type { Graph, GraphResult, PromSeries, Row } from "./api";
import { graphKey } from "./api";
import { hasData, Point, trendPercent } from "./data";

export type Entry = { result?: GraphResult; error?: string };
export type Results = Record<string, Entry>;

export const Icon = ({ d, size = 16 }: { d: string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);
export const ICON_CHART = ["M3 3v18h18", "M7 15l4-4 3 3 5-6"];
export const ICON_SYNC = ["M12 3v6", "M12 15v6", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"];

export const Skeleton = ({ height }: { height: number }) => <div className="mx-skeleton" style={{ height }} />;

export const ErrorNote = ({ text }: { text: string }) => (
  <div className="mx-empty">
    <b>Метрика недоступна.</b> <span title={text}>{text.length > 140 ? text.slice(0, 140) + "…" : text}</span>
  </div>
);

export const levelColor = (pct: number, normal: string) => (pct >= 90 ? "#DC2626" : pct >= 75 ? "#F08A24" : normal);

export function healthClass(status?: string) {
  switch (status) {
    case "Healthy":
    case "Running":
    case "Succeeded":
      return "is-ok";
    case "Progressing":
    case "Pending":
      return "is-info";
    case "Degraded":
    case "Missing":
    case "Failed":
    case "CrashLoopBackOff":
    case "Error":
      return "is-bad";
    case "Suspended":
      return "is-warn";
    default:
      return "is-muted";
  }
}

/** ▲/▼ badge for the change over the period. goodDirection decides the colour. */
export const TrendBadge = ({ points, goodDirection }: { points: Point[]; goodDirection?: string }) => {
  const d = trendPercent(points);
  if (d === null) return null;
  if (!isFinite(d) || Math.abs(d) < 1) return <span className="mx-badge is-muted" title="Без заметных изменений за период">≈</span>;
  const up = d > 0;
  const good = goodDirection ? (goodDirection === "up") === up : null;
  const cls = good === null ? "is-muted" : good ? "is-ok" : "is-bad";
  const text = Math.abs(d) >= 100 ? (d / 100 + 1).toFixed(1).replace(/\.0$/, "") + "×" : Math.round(Math.abs(d)) + "%";
  return (
    <span className={`mx-badge ${cls}`} title="Изменение за период: последние 10% окна против первых 10%">
      {up ? "▲" : "▼"} {text}
    </span>
  );
};

/** "payments-api-7d9f8c6b5-x2k4p" → "…-x2k4p" when every name shares the same long prefix. */
export function shortNames(names: string[]): string[] {
  if (names.length < 2) return names;
  let prefix = names[0];
  for (const n of names) while (prefix && n.indexOf(prefix) !== 0) prefix = prefix.slice(0, -1);
  const cut = prefix.lastIndexOf("-");
  return cut >= 8 ? names.map((n) => "…" + n.slice(cut)) : names;
}

/** An optional graph that came back empty is hidden. */
export function isHidden(g: Graph, entry?: Entry): boolean {
  return !!g.optional && !!entry && !entry.error && !hasData(entry.result?.data);
}

/** Row is hidden when every graph in it is optional and empty (e.g. HTTP blocks of a worker). */
export function rowHidden(row: Row, results: Results): boolean {
  const graphs = row.graphs || [];
  return graphs.length > 0 && graphs.every((g) => isHidden(g, results[graphKey(row, g)]));
}

/** Instant series of one unit (pod/container) — or of the whole graph when key is empty. */
export function unitSeries(data: PromSeries[] | null | undefined, key: string | undefined, unit: string | null): PromSeries[] {
  return (data || []).filter((s) => !key || unit === null || (s.metric || {})[key] === unit);
}

export const SectionTitle = ({ title, description }: { title?: string; description?: string }) =>
  title ? (
    <div className="mx-section">
      <h3>{title}</h3>
      {description && <span>{description}</span>}
    </div>
  ) : null;
