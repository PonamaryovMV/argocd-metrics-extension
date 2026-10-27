// Special row layouts: "units" (card per pod/container), "table" (one row per key), "fit" (requests vs usage).
import * as React from "react";
import type { Graph, PromSeries, Row } from "./api";
import { graphKey } from "./api";
import { Sparkline } from "./charts";
import { byName, formatParts, formatValue, lastValue, PALETTE, Point, seriesPoints, toSeries } from "./data";
import type { PodInfo } from "./pods";
import { Entry, ErrorNote, healthClass, levelColor, Results, rowHidden, SectionTitle, Skeleton, TrendBadge, unitSeries } from "./ui";

const sumLast = (list: PromSeries[]) => {
  let total: number | null = null;
  list.forEach((s) => {
    const v = lastValue(seriesPoints(s));
    if (v !== null) total = (total || 0) + v;
  });
  return total;
};

/** Values of a stat for one unit, optionally split by a label (e.g. probe_type). */
function statFor(g: Graph, entry: Entry | undefined, key: string | undefined, unit: string | null) {
  const list = unitSeries(entry?.result?.data, key, unit);
  const total = sumLast(list);
  const split = g.splitBy
    ? list
        .map((s) => ({ label: (s.metric || {})[g.splitBy as string] || "—", value: lastValue(seriesPoints(s)) }))
        .sort((a, b) => byName(a.label, b.label))
    : [];
  return { total, split, empty: list.length === 0 };
}

function thresholdFor(entry: Entry | undefined, key: string, unit: string, name: string): number | null {
  const th = (entry?.result?.thresholds || []).find((t) => (t.key || "").toLowerCase() === name);
  if (!th) return null;
  return sumLast(unitSeries(th.data, key, unit));
}

const warnClass = (g: Graph, v: number | null) => (g.warnAbove !== undefined && g.warnAbove !== null && v !== null && v > g.warnAbove ? "is-warn" : "");

// ------------------------------------------------------------------ units

const MetricBlock = ({ g, entry, keyLabel, unit, color }: { g: Graph; entry?: Entry; keyLabel: string; unit: string; color: string }) => {
  const s = toSeries(entry?.result?.data, g).find((x) => x.name === unit);
  const points: Point[] = s ? s.points : [];
  const v = lastValue(points);
  const lim = thresholdFor(entry, keyLabel, unit, "limit");
  const req = thresholdFor(entry, keyLabel, unit, "request");
  const pct = v !== null && lim ? (v / lim) * 100 : null;
  const [num, u] = formatParts(v, g.yAxisUnit);
  return (
    <div className="mx-m">
      <span className="mx-m__lbl">{g.title}</span>
      <div className="mx-m__body">
        {!entry ? (
          <Skeleton height={44} />
        ) : (
          <>
            <div className="mx-m__val">
              <b>{num}</b>
              <span>
                {u}
                {pct !== null ? ` · ${Math.round(pct)}% от limit ${formatValue(lim, g.yAxisUnit)}` : lim === null && v !== null ? " · limit не задан" : ""}
              </span>
              <TrendBadge points={points} goodDirection={g.goodDirection} />
            </div>
            {pct !== null && (
              <div className="mx-ubar" title={req !== null ? `request ${formatValue(req, g.yAxisUnit)}` : undefined}>
                <i style={{ width: Math.max(2, Math.min(100, pct)) + "%", background: levelColor(pct, "#0E8A96") }} />
                {req !== null && lim ? <span className="mx-ubar__req" style={{ left: Math.min(100, (req / lim) * 100) + "%" }} /> : null}
              </div>
            )}
            {points.length > 1 && <Sparkline points={points} color={color} height={28} />}
          </>
        )}
      </div>
    </div>
  );
};

export const UnitsRow = ({
  row,
  results,
  pods,
  colorMap,
}: {
  row: Row;
  results: Results;
  pods: PodInfo[];
  colorMap: Record<string, string>;
}) => {
  const graphs = row.graphs || [];
  const key = graphs[0]?.metricName || "pod";
  const entries = graphs.map((g) => results[graphKey(row, g)]);
  const loading = entries.every((e) => !e);

  const names = new Set<string>();
  graphs.forEach((g, i) => (entries[i]?.result?.data || []).forEach((s) => (s.metric || {})[key] && names.add((s.metric || {})[key])));
  if (key === "pod") pods.forEach((p) => names.add(p.name));
  const units = Array.from(names).sort(byName);
  const podByName: Record<string, PodInfo> = {};
  pods.forEach((p) => (podByName[p.name] = p));

  const series = graphs.filter((g) => ["line", "area"].indexOf(g.graphType) >= 0);
  const facts = graphs.filter((g) => g.graphType === "stat");
  const notes = graphs.filter((g) => g.graphType === "note");

  return (
    <section>
      <SectionTitle title={row.title} description={row.description} />
      {loading ? (
        <div className="mx-units">
          <Skeleton height={260} />
          <Skeleton height={260} />
        </div>
      ) : !units.length ? (
        <div className="mx-card mx-empty">Нет данных за период.</div>
      ) : (
        <div className="mx-units">
          {units.map((u) => {
            const pod = podByName[u];
            const color = colorMap[u] || PALETTE[0];
            return (
              <article className="mx-card mx-unit" key={u}>
                <div className="mx-unit__top">
                  <span className="mx-unit__name">
                    <i style={{ background: color }} />
                    {u}
                  </span>
                  {pod && (
                    <span className={`mx-status ${healthClass(pod.status)}`}>
                      <i />
                      {pod.status}
                    </span>
                  )}
                </div>
                {series.map((g) => (
                  <MetricBlock key={g.name} g={g} entry={results[graphKey(row, g)]} keyLabel={key} unit={u} color={color} />
                ))}
                <div className="mx-facts">
                  {facts.map((g) => {
                    const entry = results[graphKey(row, g)];
                    const st = statFor(g, entry, key, u);
                    const text = !entry
                      ? "…"
                      : entry.error
                      ? "—"
                      : g.splitBy
                      ? st.split.length
                        ? st.split.map((x) => formatParts(x.value, g.yAxisUnit)[0]).join(" / ")
                        : "—"
                      : st.empty
                      ? "—"
                      : formatValue(st.total, g.yAxisUnit);
                    const title = g.splitBy && st.split.length ? st.split.map((x) => `${x.label} ${formatParts(x.value, g.yAxisUnit)[0]}`).join(" · ") : g.description;
                    return (
                      <div className="mx-fact" key={g.name} title={title || undefined}>
                        {g.title}
                        <b className={warnClass(g, st.total)}>{text}</b>
                      </div>
                    );
                  })}
                  {pod && (
                    <div className="mx-fact">
                      Нода
                      <b className="mx-mono" title={pod.node}>
                        {pod.node}
                      </b>
                    </div>
                  )}
                </div>
                {notes.map((g) => {
                  const list = unitSeries(results[graphKey(row, g)]?.result?.data, key, u).filter((s) => (lastValue(seriesPoints(s)) || 0) > 0);
                  if (!list.length) return null;
                  const labels = Array.from(new Set(list.map((s) => (s.metric || {})[g.splitBy || ""] || ""))).filter(Boolean);
                  return (
                    <div className="mx-note" key={g.name}>
                      {g.title}: <b>{labels.join(", ") || "есть"}</b>
                    </div>
                  );
                })}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

// ------------------------------------------------------------------ table

const KEY_TITLES: Record<string, string> = {
  http_route: "Маршрут",
  server_address: "Сервис",
  server: "Зависимость",
  container: "Контейнер",
  pod: "Под",
};
const MAX_ROWS = 12;

export const TableRow = ({ row, results }: { row: Row; results: Results }) => {
  if (rowHidden(row, results)) return null;
  const graphs = row.graphs || [];
  const key = graphs[0]?.metricName || "";
  const loading = graphs.every((g) => !results[graphKey(row, g)]);
  const statCols = graphs.filter((g) => g.graphType === "stat");
  const firstStat = statCols[0];

  const valueOf = (g: Graph, k: string) => sumLast(unitSeries(results[graphKey(row, g)]?.result?.data, key, k));
  const names = new Set<string>();
  statCols.forEach((g) => (results[graphKey(row, g)]?.result?.data || []).forEach((s) => (s.metric || {})[key] && names.add((s.metric || {})[key])));
  const keys = Array.from(names).sort((a, b) => (firstStat ? (valueOf(firstStat, b) || 0) - (valueOf(firstStat, a) || 0) : byName(a, b)));
  const shown = keys.slice(0, MAX_ROWS);
  const errorEntry = graphs.map((g) => results[graphKey(row, g)]).find((e) => e && e.error);

  return (
    <section>
      <SectionTitle title={row.title} description={row.description} />
      <div className="mx-card mx-card--flush">
        {loading ? (
          <div style={{ padding: 16 }}>
            <Skeleton height={120} />
          </div>
        ) : !shown.length ? (
          errorEntry ? <ErrorNote text={errorEntry.error || ""} /> : <div className="mx-empty">Нет данных за период.</div>
        ) : (
          <div className="mx-table-wrap">
            <table className="mx-table mx-table--compact">
              <thead>
                <tr>
                  <th>{KEY_TITLES[key] || key}</th>
                  {graphs.map((g) => (
                    <th key={g.name} className={g.graphType === "stat" ? "mx-num" : ""} title={g.description || undefined}>
                      {g.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((k) => (
                  <tr key={k}>
                    <td>
                      <span className="mx-keycell">{k || "—"}</span>
                    </td>
                    {graphs.map((g) => {
                      if (g.graphType === "stat") {
                        const v = valueOf(g, k);
                        const cls = warnClass(g, v);
                        return (
                          <td key={g.name} className="mx-num mx-mono">
                            {cls ? <span className="mx-badge is-bad">{formatValue(v, g.yAxisUnit)}</span> : formatValue(v, g.yAxisUnit)}
                          </td>
                        );
                      }
                      const s = toSeries(unitSeries(results[graphKey(row, g)]?.result?.data, key, k), g)[0];
                      return (
                        <td key={g.name}>
                          <div className="mx-tspark">{s ? <Sparkline points={s.points} color="#2B6CD9" height={24} /> : null}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {keys.length > shown.length && <div className="mx-more">и ещё {keys.length - shown.length}</div>}
          </div>
        )}
      </div>
    </section>
  );
};

// ------------------------------------------------------------------ fit (requests vs real usage)

export const FitRow = ({ row, results }: { row: Row; results: Results }) => {
  const graphs = row.graphs || [];
  const key = graphs[0]?.metricName || "container";
  const byRole: Record<string, Graph> = {};
  graphs.forEach((g) => g.role && (byRole[g.role] = g));
  const unitGraph = byRole.p95 || graphs[0];
  const unit = unitGraph?.yAxisUnit;
  const get = (role: string, k: string) => (byRole[role] ? sumLast(unitSeries(results[graphKey(row, byRole[role])]?.result?.data, key, k)) : null);
  const loading = graphs.every((g) => !results[graphKey(row, g)]);
  const p95Entry = byRole.p95 ? results[graphKey(row, byRole.p95)] : undefined;

  const names = new Set<string>();
  (p95Entry?.result?.data || []).forEach((s) => (s.metric || {})[key] && names.add((s.metric || {})[key]));
  const keys = Array.from(names).sort(byName);
  const fmt = (v: number | null) => formatValue(v, unit);

  return (
    <section>
      <SectionTitle title={row.title} description={row.description} />
      <div className="mx-card">
        {loading ? (
          <Skeleton height={120} />
        ) : p95Entry?.error ? (
          <ErrorNote text={p95Entry.error} />
        ) : !keys.length ? (
          <div className="mx-empty">Нет данных.</div>
        ) : (
          <>
            <div className="mx-fit-legend">
              <span><i className="mx-fit-legend__band" />p50–p95</span>
              <span><i className="mx-fit-legend__p95" />p95</span>
              <span>▲ max</span>
              <span><i className="mx-fit-legend__mk" style={{ borderColor: "#374151" }} />request</span>
              <span><i className="mx-fit-legend__mk" style={{ borderColor: "#B42318" }} />limit</span>
            </div>
            {keys.map((k) => {
              const p50 = get("p50", k);
              const p95 = get("p95", k);
              const mx = get("max", k);
              const req = get("request", k);
              const lim = get("limit", k);
              const above = get("above", k);
              const scale = Math.max(lim || 0, req || 0, mx || 0, p95 || 0) * 1.05 || 1;
              const pos = (v: number | null) => (v === null ? 0 : Math.min(100, (v / scale) * 100)) + "%";
              let verdict: [string, string];
              if (!req) verdict = ["request не задан", "is-warn"];
              else if (p95 !== null && p95 > req) verdict = ["request занижен: p95 выше request", "is-bad"];
              else if (p95 !== null && p95 < req * 0.5) verdict = [`request завышен: p95 = ${Math.round((p95 / req) * 100)}% от request`, "is-warn"];
              else verdict = ["request подобран нормально", "is-ok"];
              return (
                <div className="mx-fit" key={k}>
                  <div className="mx-fit__name">{k}</div>
                  <div className="mx-range" title={`p50 ${fmt(p50)} · p95 ${fmt(p95)} · max ${fmt(mx)}`}>
                    <div className="mx-range__axis" />
                    {p50 !== null && p95 !== null && (
                      <div className="mx-range__band" style={{ left: pos(p50), width: `calc(${pos(p95)} - ${pos(p50)})` }} />
                    )}
                    {p95 !== null && <div className="mx-range__p95" style={{ left: pos(p95) }} />}
                    {mx !== null && (
                      <svg className="mx-range__max" style={{ left: pos(mx) }} viewBox="0 0 9 14" aria-hidden="true">
                        <path d="M4.5 0L9 8H0z" fill="#C2410C" />
                      </svg>
                    )}
                    {req ? (
                      <div className="mx-range__mk" style={{ left: pos(req), borderColor: "#374151" }}>
                        <span style={{ color: "#374151" }}>req</span>
                      </div>
                    ) : null}
                    {lim ? (
                      <div className="mx-range__mk" style={{ left: pos(lim), borderColor: "#B42318" }}>
                        <span style={{ color: "#B42318" }}>limit</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="mx-fit__out">
                    <div>
                      <b>p95 {fmt(p95)}</b> · request {req ? fmt(req) : "—"}
                    </div>
                    <div className="mx-muted mx-small">
                      {above !== null ? `выше request ${Math.round(above)}% времени · ` : ""}max {fmt(mx)}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className={`mx-badge ${verdict[1]}`}>{verdict[0]}</span>
                    </div>
                    {p95 !== null && <div className="mx-muted mx-small" style={{ marginTop: 3 }}>рекомендуемый request ≈ {fmt(p95 * 1.2)}</div>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
};
