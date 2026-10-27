// Static metrics dashboard: no controls, fixed time window, loaded once when the Metrics tab opens.
// What is shown depends on where the tab is opened: on a Deployment/Rollout/StatefulSet — all its pods,
// on a Pod — only that pod (the server filters by pod=~"<resource-name>.*").
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Dashboard, fetchDashboard, fetchGraph, Graph, graphKey, GraphResult, RequestContext, Row } from "./api";
import { BarChart, Donut, LineChart, Marker, Sparkline } from "./charts";
import { formatAge, formatParts, formatTime, formatValue, lastValue, parseDuration, PALETTE, statValue, thresholdLines, toSeries } from "./data";
import { PodInfo, podsOf } from "./pods";
import { injectStyles } from "./styles";

const DEFAULT_WINDOW = "1h";

type Entry = { result?: GraphResult; error?: string };
type Results = Record<string, Entry>;

const isStat = (g: Graph) => g.graphType === "stat";
const isSeriesChart = (g: Graph) => ["line", "area", "bar"].indexOf(g.graphType) >= 0;

// ---------- small building blocks ----------

const Icon = ({ d, size = 16 }: { d: string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);
const ICON_CHART = ["M3 3v18h18", "M7 15l4-4 3 3 5-6"];
const ICON_SYNC = ["M12 3v6", "M12 15v6", "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"];

function healthClass(status?: string) {
  switch (status) {
    case "Healthy":
      return "is-ok";
    case "Progressing":
      return "is-info";
    case "Degraded":
    case "Missing":
      return "is-bad";
    case "Suspended":
      return "is-warn";
    default:
      return "is-muted";
  }
}

const levelColor = (pct: number, normal: string) => (pct >= 90 ? "#DC2626" : pct >= 75 ? "#F08A24" : normal);

/** "payments-api-7d9f8c6b5-x2k4p" → "…-x2k4p" when every name shares the same long prefix. */
function shortNames(names: string[]): string[] {
  if (names.length < 2) return names;
  let prefix = names[0];
  for (const n of names) while (prefix && n.indexOf(prefix) !== 0) prefix = prefix.slice(0, -1);
  const cut = prefix.lastIndexOf("-");
  return cut >= 8 ? names.map((n) => "…" + n.slice(cut)) : names;
}

const Legend = ({ series, extra }: { series: { name: string; color: string }[]; extra?: { name: string; color: string }[] }) => {
  const shown = series.slice(0, 8);
  const labels = shortNames(shown.map((s) => s.name));
  return (
    <div className="mx-legend">
      {shown.map((s, i) => (
        <span key={i} className="mx-legend__item">
          <span className="mx-swatch" style={{ background: s.color }} />
          <span title={s.name}>{labels[i]}</span>
        </span>
      ))}
      {series.length > shown.length && <span className="mx-legend__item mx-muted">+{series.length - shown.length}</span>}
      {(extra || []).map((s, i) => (
        <span key={"x" + i} className="mx-legend__item">
          <span className="mx-swatch mx-swatch--dashed" style={{ borderColor: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
};

const Skeleton = ({ height }: { height: number }) => <div className="mx-skeleton" style={{ height }} />;

const ErrorNote = ({ text }: { text: string }) => (
  <div className="mx-empty">
    <b>Метрика недоступна.</b> <span title={text}>{text.length > 140 ? text.slice(0, 140) + "…" : text}</span>
  </div>
);

// ---------- KPI tiles ----------

const TrendBadge = ({ graph, first, last }: { graph: Graph; first: number | null; last: number | null }) => {
  if (first === null || last === null || first === 0) return null;
  const delta = ((last - first) / Math.abs(first)) * 100;
  if (!isFinite(delta) || Math.abs(delta) < 0.5) return <span className="mx-badge is-muted">≈</span>;
  const up = delta > 0;
  const good = graph.goodDirection ? (graph.goodDirection === "up") === up : null;
  const cls = good === null ? "is-muted" : good ? "is-ok" : "is-bad";
  return (
    <span className={`mx-badge ${cls}`} title="Изменение за период">
      {up ? "▲" : "▼"} {Math.abs(delta) >= 100 ? Math.round(delta / 100 + 1) + "×" : Math.round(Math.abs(delta)) + "%"}
    </span>
  );
};

/** Regular tile: value + sparkline, or value + bar when a "limit" threshold is configured. */
const StatTile = ({ graph, entry }: { graph: Graph; entry?: Entry }) => {
  const st = statValue(entry?.result);
  const [num, unit] = formatParts(st.value, graph.yAxisUnit);
  const color = graph.colorSchemes?.[0] || PALETTE[0];
  const pct = st.limit && st.value !== null ? (st.value / st.limit) * 100 : null;
  return (
    <article className="mx-kpi" title={graph.description || undefined}>
      <div className="mx-kpi__head">
        <span className="mx-kpi__label">{graph.title}</span>
        {pct !== null ? <span className="mx-badge is-muted">из {formatValue(st.limit, graph.yAxisUnit)}</span> : <TrendBadge graph={graph} first={st.first} last={st.value} />}
      </div>
      {!entry ? (
        <Skeleton height={56} />
      ) : entry.error ? (
        <div className="mx-kpi__error" title={entry.error}>
          нет данных
        </div>
      ) : (
        <>
          <div className="mx-kpi__value">
            <b>{num}</b>
            {unit && <span>{unit}</span>}
          </div>
          {pct !== null ? (
            <div className="mx-kpi__bar">
              <div className="mx-track">
                <div className="mx-fill" style={{ width: Math.min(100, pct) + "%", background: levelColor(pct, color) }} />
              </div>
              <div className="mx-kpi__foot">
                <span>{Math.round(pct)}% от limit</span>
              </div>
            </div>
          ) : (
            <Sparkline points={st.points} color={color} />
          )}
        </>
      )}
    </article>
  );
};

/** Half-size tile used inside a group (e.g. "Насыщение"): percent of limit with a status badge. */
const CompactTile = ({ graph, entry }: { graph: Graph; entry?: Entry }) => {
  const st = statValue(entry?.result);
  const color = graph.colorSchemes?.[0] || PALETTE[0];
  const pct = st.value === null ? null : st.limit ? (st.value / st.limit) * 100 : (graph.yAxisUnit || "").trim() === "%" ? st.value : null;
  const [num, unit] = pct !== null ? [String(Math.round(pct)), "%"] : formatParts(st.value, graph.yAxisUnit);
  const state = pct === null ? null : pct >= 90 ? ["Критично", "is-bad"] : pct >= 75 ? ["Повышено", "is-warn"] : ["Норма", "is-ok"];
  return (
    <article className="mx-kpi mx-kpi--compact" title={graph.description || undefined}>
      <div className="mx-kpi__head">
        <span className="mx-kpi__label">{graph.title}</span>
        {state && <span className={`mx-badge ${state[1]}`}>{state[0]}</span>}
      </div>
      {!entry ? (
        <Skeleton height={40} />
      ) : entry.error ? (
        <div className="mx-kpi__error" title={entry.error}>
          нет данных
        </div>
      ) : (
        <>
          <div className="mx-kpi__value">
            <b>{num}</b>
            {unit && <span>{unit}</span>}
          </div>
          {pct !== null && (
            <div className="mx-kpi__bar">
              <div className="mx-track mx-track--thin">
                <div className="mx-fill" style={{ width: Math.min(100, Math.max(0, pct)) + "%", background: levelColor(pct, color) }} />
              </div>
              {st.limit !== null && (
                <div className="mx-kpi__foot">
                  <span>limit</span>
                  <b>{formatValue(st.limit, graph.yAxisUnit)}</b>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
};

// ---------- chart cards ----------

const ChartCard = ({ graph, entry, markers, start, end }: { graph: Graph; entry?: Entry; markers: Marker[]; start: number; end: number }) => {
  const series = useMemo(() => toSeries(entry?.result?.data, graph), [entry, graph]);
  const thresholds = useMemo(() => thresholdLines(entry?.result?.thresholds), [entry]);
  const unit = graph.yAxisUnit;
  const current = series.length === 1 ? lastValue(series[0].points) : null;
  const visibleMarkers = markers.filter((m) => m.t >= start && m.t <= end);
  const lastMarker = visibleMarkers[visibleMarkers.length - 1];

  return (
    <article className="mx-card">
      <div className="mx-card__head">
        <div className="mx-card__titles">
          <h3 className="mx-card__title">{graph.title}</h3>
          {graph.description && <div className="mx-card__sub">{graph.description}</div>}
        </div>
        {current !== null ? <div className="mx-card__value">{formatValue(current, unit)}</div> : series.length > 0 && <Legend series={series} extra={thresholds} />}
      </div>
      {!entry ? (
        <Skeleton height={220} />
      ) : entry.error ? (
        <ErrorNote text={entry.error} />
      ) : !series.length ? (
        <div className="mx-empty">Нет данных за период.</div>
      ) : (
        <>
          {current !== null && thresholds.length > 0 && <Legend series={[]} extra={thresholds} />}
          {graph.graphType === "bar" ? (
            <BarChart series={series} markers={markers} unit={unit} start={start} end={end} ariaLabel={graph.title} />
          ) : (
            <LineChart
              series={series}
              thresholds={thresholds}
              markers={markers}
              unit={unit}
              start={start}
              end={end}
              area={graph.graphType === "area" || series.length === 1}
              ariaLabel={graph.title}
            />
          )}
          {lastMarker && (
            <div className="mx-card__foot">
              <span className="mx-pill mx-pill--sync">
                <Icon d={ICON_SYNC} size={12} />
                Sync {lastMarker.label} · {formatTime(lastMarker.t)}
              </span>
            </div>
          )}
        </>
      )}
    </article>
  );
};

const PieCard = ({ graph, entry }: { graph: Graph; entry?: Entry }) => {
  const series = toSeries(entry?.result?.data, graph);
  const items = series.map((s) => ({ name: s.name, color: s.color, value: s.points.reduce((a, p) => a + p.v, 0) / Math.max(1, s.points.length) }));
  return (
    <article className="mx-card">
      <div className="mx-card__head">
        <div className="mx-card__titles">
          <h3 className="mx-card__title">{graph.title}</h3>
          <div className="mx-card__sub mx-sans">Среднее за период</div>
        </div>
      </div>
      {!entry ? <Skeleton height={140} /> : entry.error ? <ErrorNote text={entry.error} /> : <Donut items={items} unit={graph.yAxisUnit} />}
    </article>
  );
};

// ---------- rows ----------

const RowView = ({ row, results, markers, start, end }: { row: Row; results: Results; markers: Marker[]; start: number; end: number }) => {
  const graphs = row.graphs || [];

  if (graphs.length > 0 && graphs.every(isStat)) {
    // Stats sharing a "group" are drawn as one cell split in halves.
    const cells: Graph[][] = [];
    graphs.forEach((g) => {
      const prev = cells[cells.length - 1];
      if (g.group && prev && prev[0].group === g.group) prev.push(g);
      else cells.push([g]);
    });
    return (
      <section className="mx-kpis" aria-label={row.title || row.name}>
        {cells.map((cell) =>
          cell.length === 1 && !cell[0].group ? (
            <StatTile key={cell[0].name} graph={cell[0]} entry={results[graphKey(row, cell[0])]} />
          ) : (
            <div key={cell[0].name} className="mx-kpi-split" aria-label={cell[0].group}>
              {cell.map((g) => (
                <CompactTile key={g.name} graph={g} entry={results[graphKey(row, g)]} />
              ))}
            </div>
          )
        )}
      </section>
    );
  }

  const defaultSpan = Math.max(1, Math.floor(12 / Math.max(1, graphs.length)));
  return (
    <section className="mx-grid" aria-label={row.title || row.name}>
      {graphs.map((g) => {
        const span = Math.max(1, Math.min(12, g.span || defaultSpan));
        const entry = results[graphKey(row, g)];
        const body = isStat(g) ? (
          <StatTile graph={g} entry={entry} />
        ) : g.graphType === "pie" ? (
          <PieCard graph={g} entry={entry} />
        ) : (
          <ChartCard graph={g} entry={entry} markers={markers} start={start} end={end} />
        );
        return (
          <div key={g.name} className={`mx-cell mx-span-${span}`}>
            {body}
          </div>
        );
      })}
    </section>
  );
};

// ---------- pods table ----------

const PodsTable = ({ pods, dashboard, results, now }: { pods: PodInfo[]; dashboard: Dashboard; results: Results; now: number }) => {
  // Metric columns: per-pod series charts (metricName = "pod"), first three distinct titles.
  const columns = useMemo(() => {
    const out: { title: string; graph: Graph; key: string }[] = [];
    (dashboard.rows || []).forEach((row) =>
      (row.graphs || []).forEach((g) => {
        if (g.metricName === "pod" && isSeriesChart(g) && !out.some((c) => c.title === g.title) && out.length < 3) {
          out.push({ title: g.title.replace(/ по подам$/, ""), graph: g, key: graphKey(row, g) });
        }
      })
    );
    return out;
  }, [dashboard]);

  const perPod = useMemo(
    () =>
      columns.map((c) => {
        const entry = results[c.key];
        const series = toSeries(entry?.result?.data, c.graph);
        const limits = new Map<string, number>();
        (entry?.result?.thresholds || [])
          .filter((t) => (t.key || "").toLowerCase() === "limit")
          .forEach((t) =>
            (t.data || []).forEach((s) => {
              const v = s.values?.length ? parseFloat(s.values[s.values.length - 1][1]) : NaN;
              if (s.metric?.pod && isFinite(v)) limits.set(s.metric.pod, v);
            })
          );
        const max = series.reduce((m, s) => Math.max(m, lastValue(s.points) || 0), 0);
        return { series, limits, max };
      }),
    [columns, results]
  );

  // Pods from the Argo CD tree; if it is empty, fall back to pod names seen in metrics.
  const rows: PodInfo[] = useMemo(() => {
    if (pods.length) return pods;
    const names = new Set<string>();
    perPod.forEach((c) => c.series.forEach((s) => names.add(s.name)));
    return Array.from(names)
      .sort()
      .map((name) => ({ name, status: "—", health: "Unknown", restarts: null, node: "—" }));
  }, [pods, perPod]);

  if (!rows.length) return null;
  const colorOf = (name: string) => perPod[0]?.series.find((s) => s.name === name)?.color || "#9CA3AF";

  return (
    <section className="mx-card mx-card--flush" aria-label="Поды">
      <div className="mx-table-head">
        <h3 className="mx-card__title">
          Поды <span className="mx-count">{rows.length}</span>
        </h3>
      </div>
      <div className="mx-table-wrap">
        <table className="mx-table">
          <thead>
            <tr>
              <th>Под</th>
              <th>Статус</th>
              <th className="mx-num">Рестарты</th>
              {columns.map((c) => (
                <th key={c.key} style={{ width: 190 }}>
                  {c.title}
                </th>
              ))}
              {columns.length > 0 && <th>Тренд</th>}
              <th>Нода</th>
              <th className="mx-num">Возраст</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name}>
                <td>
                  <span className="mx-pod">
                    <span className="mx-pod__color" style={{ background: colorOf(p.name) }} />
                    {p.name}
                  </span>
                </td>
                <td>
                  <span className={`mx-status ${healthClass(p.health)}`}>
                    <i />
                    {p.status}
                  </span>
                </td>
                <td className="mx-num">{p.restarts ? <span className="mx-restarts">{p.restarts}</span> : p.restarts === 0 ? "0" : "—"}</td>
                {columns.map((c, i) => {
                  const s = perPod[i].series.find((x) => x.name === p.name);
                  const v = s ? lastValue(s.points) : null;
                  const limit = perPod[i].limits.get(p.name);
                  const pct = v === null ? 0 : limit ? (v / limit) * 100 : perPod[i].max ? (v / perPod[i].max) * 100 : 0;
                  return (
                    <td key={c.key}>
                      <div className="mx-cellbar" title={limit ? `${Math.round(pct)}% от limit` : undefined}>
                        <div className="mx-track mx-track--thin">
                          <div className="mx-fill" style={{ width: Math.min(100, pct) + "%", background: limit ? levelColor(pct, "#0E8A96") : "#0E8A96" }} />
                        </div>
                        <span className="mx-mono">{formatValue(v, c.graph.yAxisUnit)}</span>
                      </div>
                    </td>
                  );
                })}
                {columns.length > 0 && (
                  <td>
                    <div className="mx-podspark">
                      <Sparkline points={perPod[0].series.find((x) => x.name === p.name)?.points || []} color={colorOf(p.name)} height={22} />
                    </div>
                  </td>
                )}
                <td className="mx-mono mx-muted">{p.node}</td>
                <td className="mx-num mx-muted">{formatAge(p.createdAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ---------- main ----------

function syncMarkers(application: any): Marker[] {
  const history: any[] = application?.status?.history || [];
  return history
    .filter((h) => h.deployedAt)
    .map((h) => {
      const rev: string = h.revision || (h.revisions && h.revisions[0]) || "";
      const t = Date.parse(h.deployedAt);
      const short = rev.length > 12 ? rev.slice(0, 7) : rev;
      return { t, label: short || "sync", title: `Синк ${short} · ${formatTime(t)}` };
    })
    .filter((m) => isFinite(m.t))
    .sort((a, b) => a.t - b.t);
}

function windowLabel(d: string): string {
  const m = /^(\d+)([mhd])$/.exec(d);
  if (!m) return d;
  const n = parseInt(m[1], 10);
  if (m[2] === "h" && n === 1) return "Последний час";
  const unit = m[2] === "m" ? "мин" : m[2] === "h" ? "ч" : "д";
  return `Последние ${n} ${unit}`;
}

export const MetricsDashboard = ({ application, resource, tree }: any) => {
  injectStyles();

  const ctx: RequestContext = useMemo(
    () => ({
      applicationName: application?.metadata?.name || "",
      applicationNamespace: application?.metadata?.namespace || "",
      project: application?.spec?.project || "",
      uid: application?.metadata?.uid || "",
      resourceKind: resource?.kind || "",
      resourceName: resource?.kind === "Application" ? "" : resource?.metadata?.name || "",
      namespace: resource?.metadata?.namespace || "",
    }),
    [application?.metadata?.name, application?.metadata?.namespace, application?.spec?.project, application?.metadata?.uid, resource?.kind, resource?.metadata?.name, resource?.metadata?.namespace]
  );

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Results>({});
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);

  // Load the dashboard config, then every graph of it once. Re-opening the tab reloads.
  useEffect(() => {
    let cancelled = false;
    setDashboard(null);
    setError(null);
    setResults({});
    fetchDashboard(ctx)
      .then((d) => {
        if (cancelled) return;
        if (!d || !d.rows || !d.rows.length) {
          setError(`Для ${ctx.resourceKind} дашборд не настроен.`);
          return;
        }
        setDashboard(d);
        const duration = (d.intervals && d.intervals[0]) || DEFAULT_WINDOW;
        const end = Date.now();
        setRange({ start: end - parseDuration(duration, 36e5), end });
        (d.rows || []).forEach((row) =>
          (row.graphs || []).forEach((g) => {
            const key = graphKey(row, g);
            fetchGraph(ctx, row, g, duration)
              .then((result) => !cancelled && setResults((r) => ({ ...r, [key]: { result } })))
              .catch((e) => !cancelled && setResults((r) => ({ ...r, [key]: { error: e?.message || String(e) } })));
          })
        );
      })
      .catch((e) => !cancelled && setError(e?.message || String(e)));
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  const markers = useMemo(() => syncMarkers(application), [application]);
  const pods = useMemo(() => podsOf(resource, tree), [resource, tree]);

  if (error) {
    return (
      <div className="mx-root">
        <div className="mx-state">
          <Icon d={ICON_CHART} size={28} />
          <div>
            <b>Метрики недоступны</b>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const health = application?.status?.health?.status;
  const sync = application?.status?.sync?.status;
  const revision: string = application?.status?.sync?.revision || (application?.status?.sync?.revisions || [])[0] || "";
  const cluster = application?.spec?.destination?.name || application?.spec?.destination?.server || "";
  const lastSync = markers[markers.length - 1];
  const duration = (dashboard?.intervals && dashboard.intervals[0]) || DEFAULT_WINDOW;

  return (
    <div className="mx-root">
      <header className="mx-header">
        <div className="mx-header__top">
          <div className="mx-ident">
            <div className="mx-logo">
              <Icon d={ICON_CHART} size={20} />
            </div>
            <div>
              <div className="mx-ident__row">
                <h2 className="mx-ident__name">{ctx.resourceName || ctx.applicationName}</h2>
                {health && (
                  <span className={`mx-pill ${healthClass(health)}`}>
                    <i />
                    {health}
                  </span>
                )}
                {sync && (
                  <span className={`mx-pill ${sync === "Synced" ? "is-info" : "is-warn"}`}>
                    {sync}
                    {revision ? ` · ${revision.length > 12 ? revision.slice(0, 7) : revision}` : ""}
                  </span>
                )}
                {lastSync && <span className="mx-pill mx-pill--sync mx-mono">Deploy {formatTime(lastSync.t)}</span>}
              </div>
              <div className="mx-ident__meta">
                {ctx.resourceKind}
                {ctx.namespace && (
                  <>
                    {" · ns "}
                    <code>{ctx.namespace}</code>
                  </>
                )}
                {pods.length > 0 && ` · ${pods.length} ${pods.length === 1 ? "под" : pods.length < 5 ? "пода" : "подов"}`}
                {cluster && (
                  <>
                    {" · кластер "}
                    <code>{cluster}</code>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mx-period">
            <b>{windowLabel(duration)}</b>
            {range && <span>на {formatTime(range.end)}</span>}
          </div>
        </div>
      </header>

      <main className="mx-main">
        {!dashboard || !range ? (
          <>
            <div className="mx-kpis">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={110} />
              ))}
            </div>
            <Skeleton height={300} />
          </>
        ) : (
          <>
            {(dashboard.rows || []).map((row) => (
              <RowView key={row.name} row={row} results={results} markers={markers} start={range.start} end={range.end} />
            ))}
            {dashboard.showPods !== false && <PodsTable pods={pods} dashboard={dashboard} results={results} now={range.end} />}
            <footer className="mx-footer">
              <span>Источник: {dashboard.providerType === "wavefront" ? "Wavefront" : "Prometheus"}</span>
              <span>Данные на {formatTime(range.end, true)}. Чтобы обновить, откройте вкладку заново.</span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
};

export default MetricsDashboard;
