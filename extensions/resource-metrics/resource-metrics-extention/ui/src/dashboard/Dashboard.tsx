// Metrics tab. What is shown depends on where the tab is opened: on a Deployment/Rollout/StatefulSet —
// all its pods (the server filters by pod=~"<resource-name>.*"), on a Pod — that pod and its containers.
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dashboard, fetchDashboard, fetchGraph, Graph, graphKey, RequestContext, Row } from "./api";
import { BarChart, Donut, LineChart, Marker, Sparkline } from "./charts";
import {
  byName,
  formatDuration,
  formatParts,
  formatTime,
  formatValue,
  lastValue,
  parseDuration,
  PALETTE,
  seriesPoints,
  statValue,
  thresholdLines,
  toSeries,
} from "./data";
import { FitRow, TableRow, UnitsRow } from "./layouts";
import { podsOf } from "./pods";
import { injectStyles } from "./styles";
import { Entry, ErrorNote, healthClass, Icon, ICON_CHART, ICON_SYNC, isHidden, levelColor, Results, rowHidden, SectionTitle, shortNames, Skeleton, TrendBadge } from "./ui";

const DEFAULT_INTERVALS = ["15m", "1h", "6h", "24h"];

// ---------- KPI tiles ----------

const StatTile = ({ graph, entry }: { graph: Graph; entry?: Entry }) => {
  const st = statValue(entry?.result);
  const [num, unit] = formatParts(st.value, graph.yAxisUnit);
  const color = graph.colorSchemes?.[0] || PALETTE[0];
  const pct = st.limit && st.value !== null ? (st.value / st.limit) * 100 : null;
  const warn = graph.warnAbove !== undefined && graph.warnAbove !== null && st.value !== null && st.value > graph.warnAbove;
  const split = graph.splitBy
    ? (entry?.result?.data || [])
        .map((s) => ({ label: (s.metric || {})[graph.splitBy as string] || "—", value: lastValue(seriesPoints(s)) }))
        .sort((a, b) => byName(a.label, b.label))
    : [];
  return (
    <article className="mx-kpi" title={graph.description || undefined}>
      <div className="mx-kpi__head">
        <span className="mx-kpi__label">{graph.title}</span>
        {pct !== null ? (
          <span className="mx-badge is-muted">из {formatValue(st.limit, graph.yAxisUnit)}</span>
        ) : (
          <TrendBadge points={st.points} goodDirection={graph.goodDirection} />
        )}
      </div>
      {!entry ? (
        <Skeleton height={56} />
      ) : entry.error ? (
        <div className="mx-kpi__error" title={entry.error}>
          нет данных
        </div>
      ) : (
        <>
          <div className={`mx-kpi__value${warn ? " is-warn" : ""}`}>
            <b>{st.value === null && graph.queryType === "instant" ? "0" : num}</b>
            {unit && <span>{unit}</span>}
            {graph.queryType === "instant" && <span>за период</span>}
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
          ) : split.length ? (
            <div className="mx-kpi__foot mx-kpi__foot--wrap">
              {split.map((s) => `${s.label} ${formatParts(s.value, graph.yAxisUnit)[0]}`).join(" · ")}
            </div>
          ) : st.points.length > 1 ? (
            <Sparkline points={st.points} color={color} />
          ) : graph.description ? (
            <div className="mx-kpi__foot mx-kpi__foot--wrap">{graph.description}</div>
          ) : null}
        </>
      )}
    </article>
  );
};

// ---------- chart cards ----------

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

const ChartCard = ({
  graph,
  entry,
  markers,
  start,
  end,
  colorMap,
}: {
  graph: Graph;
  entry?: Entry;
  markers: Marker[];
  start: number;
  end: number;
  colorMap: Record<string, string>;
}) => {
  const series = useMemo(() => toSeries(entry?.result?.data, graph, colorMap), [entry, graph, colorMap]);
  const thresholds = useMemo(() => thresholdLines(entry?.result?.thresholds), [entry]);
  const unit = graph.yAxisUnit;
  const visibleMarkers = markers.filter((m) => m.t >= start && m.t <= end);
  const lastMarker = visibleMarkers[visibleMarkers.length - 1];

  return (
    <article className="mx-card">
      <div className="mx-card__head">
        <div className="mx-card__titles">
          <h3 className="mx-card__title">{graph.title}</h3>
          {graph.description && <div className="mx-card__sub">{graph.description}</div>}
        </div>
        {series.length > 0 && <Legend series={series} extra={thresholds} />}
      </div>
      {!entry ? (
        <Skeleton height={220} />
      ) : entry.error ? (
        <ErrorNote text={entry.error} />
      ) : !series.length ? (
        <div className="mx-empty">Нет данных за период.</div>
      ) : (
        <>
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

// ---------- default row: tiles or charts ----------

const DefaultRow = ({
  row,
  results,
  markers,
  start,
  end,
  colorMap,
}: {
  row: Row;
  results: Results;
  markers: Marker[];
  start: number;
  end: number;
  colorMap: Record<string, string>;
}) => {
  const graphs = (row.graphs || []).filter((g) => !isHidden(g, results[graphKey(row, g)]));
  if (!graphs.length) return null;

  if (graphs.every((g) => g.graphType === "stat")) {
    return (
      <section>
        {row.description && <SectionTitle title={row.title} description={row.description} />}
        <div className="mx-kpis">
          {graphs.map((g) => (
            <StatTile key={g.name} graph={g} entry={results[graphKey(row, g)]} />
          ))}
        </div>
      </section>
    );
  }

  const defaultSpan = Math.max(1, Math.floor(12 / graphs.length));
  // When some cards of a row are hidden, the rest take the free width.
  const spans = graphs.map((g) => Math.max(1, Math.min(12, g.span || defaultSpan)));
  const total = spans.reduce((a, s) => a + s, 0);
  const scaled = total < 12 && graphs.length < (row.graphs || []).length ? spans.map((s) => Math.round((s / total) * 12)) : spans;

  return (
    <section>
      {row.description && <SectionTitle title={row.title} description={row.description} />}
      <div className="mx-grid">
        {graphs.map((g, i) => {
          const entry = results[graphKey(row, g)];
          const body =
            g.graphType === "stat" ? (
              <StatTile graph={g} entry={entry} />
            ) : g.graphType === "pie" ? (
              <PieCard graph={g} entry={entry} />
            ) : (
              <ChartCard graph={g} entry={entry} markers={markers} start={start} end={end} colorMap={colorMap} />
            );
          return (
            <div key={g.name} className={`mx-cell mx-span-${scaled[i]}`}>
              {body}
            </div>
          );
        })}
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

/** Pods/containers get fixed colours, so a unit looks the same on cards and charts. */
function buildColorMap(dashboard: Dashboard | null, results: Results, podNames: string[], unitKey: string): Record<string, string> {
  const names = new Set<string>(unitKey === "pod" ? podNames : []);
  (dashboard?.rows || []).forEach((row) =>
    (row.graphs || []).forEach((g) => {
      if (g.metricName !== unitKey) return;
      (results[graphKey(row, g)]?.result?.data || []).forEach((s) => {
        const n = (s.metric || {})[g.metricName as string];
        if (n) names.add(n);
      });
    })
  );
  const map: Record<string, string> = {};
  Array.from(names)
    .sort(byName)
    .forEach((n, i) => (map[n] = PALETTE[i % PALETTE.length]));
  return map;
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
  const [duration, setDuration] = useState("1h");
  const [results, setResults] = useState<Results>({});
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  // Dashboard config for this resource kind.
  useEffect(() => {
    let cancelled = false;
    setDashboard(null);
    setError(null);
    setResults({});
    setRange(null);
    fetchDashboard(ctx)
      .then((d) => {
        if (cancelled) return;
        if (!d || !d.rows || !d.rows.length) {
          setError(`Для ${ctx.resourceKind} дашборд не настроен.`);
          return;
        }
        const intervals = d.intervals && d.intervals.length ? d.intervals : DEFAULT_INTERVALS;
        setDuration(intervals.indexOf("1h") >= 0 ? "1h" : intervals[0]);
        setDashboard(d);
      })
      .catch((e) => !cancelled && setError(e?.message || String(e)));
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  // All graphs for the selected period; the new set replaces the old one at once.
  useEffect(() => {
    if (!dashboard) return;
    const id = ++requestId.current;
    const end = Date.now();
    const start = end - parseDuration(duration, 36e5);
    const next: Results = {};
    setLoading(true);
    const jobs: Promise<void>[] = [];
    (dashboard.rows || []).forEach((row) =>
      (row.graphs || []).forEach((g) => {
        const key = graphKey(row, g);
        jobs.push(
          fetchGraph(ctx, row, g, duration)
            .then((result) => {
              next[key] = { result };
            })
            .catch((e) => {
              next[key] = { error: e?.message || String(e) };
            })
        );
      })
    );
    Promise.all(jobs).then(() => {
      if (id !== requestId.current) return;
      setResults(next);
      setRange({ start, end });
      setLoading(false);
    });
  }, [dashboard, duration, ctx]);

  const markers = useMemo(() => syncMarkers(application), [application]);
  const pods = useMemo(() => podsOf(resource, tree), [resource, tree]);
  // Units are pods on a workload and containers on a Pod.
  const unitKey = ctx.resourceKind === "Pod" ? "container" : "pod";
  const colorMap = useMemo(() => buildColorMap(dashboard, results, pods.map((p) => p.name), unitKey), [dashboard, results, pods, unitKey]);

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
  const lastSync = markers[markers.length - 1];
  const intervals = dashboard?.intervals && dashboard.intervals.length ? dashboard.intervals : DEFAULT_INTERVALS;
  const pod = ctx.resourceKind === "Pod" ? pods[0] : undefined;

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
                {pod ? (
                  <>
                    {" · нода "}
                    <code>{pod.node}</code>
                  </>
                ) : (
                  pods.length > 0 && ` · ${pods.length} ${pods.length === 1 ? "под" : pods.length < 5 ? "пода" : "подов"}`
                )}
              </div>
            </div>
          </div>
          <div className="mx-toolbar">
            <div className="mx-seg" role="group" aria-label="Период">
              {intervals.map((d) => (
                <button key={d} type="button" className={d === duration ? "is-active" : ""} onClick={() => setDuration(d)}>
                  {formatDuration(d)}
                </button>
              ))}
            </div>
            <span className="mx-updated">{loading ? "загрузка…" : range ? `на ${formatTime(range.end)}` : ""}</span>
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
            {(dashboard.rows || []).map((row) => {
              if (rowHidden(row, results)) return null;
              switch (row.layout) {
                case "units":
                  return <UnitsRow key={row.name} row={row} results={results} pods={pods} colorMap={colorMap} />;
                case "table":
                  return <TableRow key={row.name} row={row} results={results} />;
                case "fit":
                  return <FitRow key={row.name} row={row} results={results} />;
                default:
                  return <DefaultRow key={row.name} row={row} results={results} markers={markers} start={range.start} end={range.end} colorMap={colorMap} />;
              }
            })}
            <footer className="mx-footer">
              <span>Источник: {dashboard.providerType === "wavefront" ? "Wavefront" : "Prometheus"}</span>
              <span>Данные на {formatTime(range.end, true)}</span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
};

export default MetricsDashboard;
