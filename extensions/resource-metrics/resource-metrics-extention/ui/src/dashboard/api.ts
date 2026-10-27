// Types and HTTP client for argocd-metrics-server (reached through the Argo CD proxy extension).

export interface Threshold {
  key: string;
  name: string;
  color?: string;
  value?: string;
  unit?: string;
}

export type GraphType = "line" | "area" | "bar" | "stat" | "gauge" | "pie";

export interface Graph {
  name: string;
  title: string;
  description?: string;
  graphType: GraphType | string;
  metricName?: string;
  colorSchemes?: string[];
  thresholds?: Threshold[];
  yAxisUnit?: string;
  valueRounding?: number;
  /** Width of the card in a 12-column grid. Default: 12 / number of non-stat graphs in the row. */
  span?: number;
  /** For stat tiles: which direction of change is good ("up" | "down"). Empty = neutral. */
  goodDirection?: "up" | "down" | "";
  /** Stat tiles with the same group are drawn as one KPI cell split in halves (e.g. "Насыщение"). */
  group?: string;
}

export interface Row {
  name: string;
  title?: string;
  tab?: string;
  graphs: Graph[];
}

export interface Dashboard {
  name?: string;
  groupKind?: string;
  refreshRate?: string;
  tabs?: string[];
  rows?: Row[];
  intervals?: string[];
  providerType?: string;
  /** Optional link template, e.g. https://grafana/d/abc?var-namespace={{.namespace}}&var-name={{.name}} */
  grafanaUrl?: string;
  /** Show the pods table under the charts. Default true. */
  showPods?: boolean;
}

export interface PromSeries {
  metric: Record<string, string>;
  values: [number, string][];
}

export interface ThresholdResult {
  key: string;
  name: string;
  color?: string;
  value?: string;
  unit?: string;
  data: PromSeries[] | null;
}

export interface GraphResult {
  data: PromSeries[] | null;
  thresholds?: ThresholdResult[] | null;
}

export interface RequestContext {
  applicationName: string;
  applicationNamespace: string;
  project: string;
  uid: string;
  resourceKind: string;
  resourceName: string;
  namespace: string;
}

export function getHeaders(ctx: RequestContext): Record<string, string> {
  return {
    "Argocd-Application-Name": `${ctx.applicationNamespace}:${ctx.applicationName}`,
    "Argocd-Project-Name": ctx.project,
  };
}

const BASE = "/extensions/metrics/api/applications";

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (e) {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === "string" ? body : body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

export async function fetchDashboard(ctx: RequestContext): Promise<Dashboard> {
  const url = `${BASE}/${encodeURIComponent(ctx.applicationName)}/groupkinds/${ctx.resourceKind.toLowerCase()}/dashboards`;
  const res = await fetch(url, { headers: getHeaders(ctx) });
  return readJson(res);
}

export async function fetchGraph(
  ctx: RequestContext,
  row: Row,
  graph: Graph,
  duration: string
): Promise<GraphResult> {
  const params = [
    ["name", `${ctx.resourceName}.*`],
    ["namespace", ctx.namespace],
    ["application_name", ctx.applicationName],
    ["project", ctx.project],
    ["uid", ctx.uid],
    ["duration", duration],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url =
    `${BASE}/${encodeURIComponent(ctx.applicationName)}/groupkinds/${ctx.resourceKind.toLowerCase()}` +
    `/rows/${encodeURIComponent(row.name)}/graphs/${encodeURIComponent(graph.name)}?${params}`;
  const res = await fetch(url, { headers: getHeaders(ctx) });
  return readJson(res);
}

export const graphKey = (row: Row, graph: Graph) => `${row.name}/${graph.name}`;
