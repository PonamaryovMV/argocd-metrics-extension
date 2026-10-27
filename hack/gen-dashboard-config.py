#!/usr/bin/env python3
"""Generates the metrics-server dashboard config from one description.

Writes:
  cm.yaml                   – ConfigMap as an item for Helm `extraObjects` (same format as before)
  manifests/configmap.yaml  – plain ConfigMap for kubectl/kustomize
  app/config.json           – the same config for local runs

Only generic metrics are used (no language/runtime specific ones):
  * cAdvisor + kube-state-metrics + kubelet probes – resources, restarts, probes
  * OpenTelemetry semantic-convention HTTP metrics – http_server_* / http_client_*
  * service graph from traces – non-HTTP dependencies (Redis, DB, Kafka …)

Run:  python3 hack/gen-dashboard-config.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROMETHEUS = "http://pr-kube-prometheus-stack-prometheus.mon.svc.cluster.local:9090"

# Filled in by the metrics server from the opened resource:
#   {{.namespace}}  namespace of the resource
#   {{.name}}       "<resource-name>.*" – matches all pods of a Deployment, or one pod
#   {{.resource}}   exact resource name (Deployment name = service name in traces)
#   {{.duration}}   selected period: 15m / 1h / 6h / 24h
SEL = 'namespace="{{.namespace}}", pod=~"{{.name}}"'
CONT = 'container!="", container!="POD"'
# Service endpoints that would blur RPS and latency.
SKIP_ROUTES = 'http_route!~"/health.*|/healthz|/ready.*|/live.*|/metrics|/scalar.*|/openapi.*|/swagger.*|/favicon.ico"'
HTTP = f"{SEL}, {SKIP_ROUTES}"
SRV = "http_server_request_duration_seconds"
CLI = "http_client_request_duration_seconds"
SG = "traces_service_graph_request"
D = "{{.duration}}"


def stat(name, title, query, unit="", **kw):
    g = {"name": name, "title": title, "graphType": "stat", "yAxisUnit": unit, "queryExpression": query}
    g.update(kw)
    return g


def line(name, title, query, unit="", **kw):
    g = {"name": name, "title": title, "graphType": "line", "yAxisUnit": unit, "queryExpression": query}
    g.update(kw)
    return g


def ksm(metric, resource, by):
    return f'sum by ({by}) (kube_pod_container_resource_{metric}{{{SEL}, resource="{resource}"}})'


def limit(resource, by):
    return {"key": "limit", "name": "limit", "queryExpression": ksm("limits", resource, by)}


def request(resource, by):
    return {"key": "request", "name": "request", "queryExpression": ksm("requests", resource, by)}


def cpu(by):
    return f"sum by ({by}) (rate(container_cpu_usage_seconds_total{{{SEL}, {CONT}}}[5m]))"


def mem(by):
    return f"sum by ({by}) (container_memory_working_set_bytes{{{SEL}, {CONT}}})"


def five_xx(base, by=""):
    grp = f" by ({by})" if by else ""
    total = f"sum{grp} (rate({base}_count{{{HTTP}}}[{{w}}]))"
    errors = f'sum{grp} (rate({base}_count{{{HTTP}, http_response_status_code=~"5.."}}[{{w}}]))'
    # "or 0 * total" keeps keys that had no 5xx at all, so they show 0 instead of nothing.
    return f"100 * ({errors} or 0 * {total}) / {total}"


def quantile(q, metric, by, window, sel=HTTP):
    return f"histogram_quantile({q}, sum by (le{', ' + by if by else ''}) (rate({metric}_bucket{{{sel}}}[{window}])))"


# ---------------------------------------------------------------- KPI tiles
def kpi(unit_by):
    return {
        "name": "kpi",
        "title": "Ключевые показатели",
        "graphs": [
            stat("requests", "Запросы", f"sum(rate({SRV}_count{{{HTTP}}}[1m]))", "req/s",
                 goodDirection="up", optional=True, description="Входящие HTTP-запросы"),
            stat("errors_5xx", "Ошибки 5xx", five_xx(SRV).replace("{w}", "5m"), "%",
                 goodDirection="down", optional=True, colorSchemes=["#B42318"]),
            stat("latency_p90", "Latency p90", quantile(0.9, SRV, "", "5m"), "s",
                 goodDirection="down", optional=True, colorSchemes=["#3B82F6"]),
            stat("latency_p99", "Latency p99", quantile(0.99, SRV, "", "5m"), "s",
                 goodDirection="down", optional=True, colorSchemes=["#C2410C"]),
            stat("restarts", "Рестарты", f"sum(increase(kube_pod_container_status_restarts_total{{{SEL}}}[{D}]))", "count",
                 queryType="instant", warnAbove=0, description="Рестарты контейнеров за выбранный период"),
            stat("probes_failed", "Неудачные probe",
                 f'sum by (probe_type) (increase(prober_probe_total{{{SEL}, result="failed"}}[{D}]))', "count",
                 queryType="instant", splitBy="probe_type", warnAbove=0,
                 description="Неудачные liveness/readiness/startup probe за выбранный период"),
        ],
    }


def http_charts():
    q = " or ".join(
        f'label_replace({quantile(v, SRV, "", "5m")}, "quantile", "{k}", "", "")'
        for k, v in (("p50", 0.5), ("p90", 0.9), ("p99", 0.99))
    )
    return {
        "name": "http_charts",
        "title": "Входящие запросы",
        "graphs": [
            line("latency", "Latency", q, "s", metricName="quantile", span=6, optional=True,
                 description="http_server_request_duration_seconds", colorSchemes=["#1E40AF", "#3B82F6", "#C2410C"]),
            {
                "name": "traffic_by_code", "title": "Запросы по кодам ответа", "graphType": "bar", "metricName": "code",
                "yAxisUnit": "req/s", "span": 6, "optional": True, "description": "http_server_request_duration_seconds_count",
                "queryExpression": f'sum by (code) (label_replace(rate({SRV}_count{{{HTTP}}}[1m]), "code", "${{1}}xx", "http_response_status_code", "(.).."))',
            },
        ],
    }


def routes():
    by = "http_route"
    return {
        "name": "routes", "title": "Эндпоинты", "layout": "table",
        "description": "входящие HTTP по маршрутам · среднее за период",
        "graphs": [
            stat("route_rps", "Запросы", f"sum by ({by}) (rate({SRV}_count{{{HTTP}}}[{D}]))", "req/s",
                 metricName=by, queryType="instant", optional=True),
            stat("route_5xx", "5xx", five_xx(SRV, by).replace("{w}", D), "%",
                 metricName=by, queryType="instant", warnAbove=1, optional=True),
            stat("route_p90", "p90", quantile(0.9, SRV, by, D), "s", metricName=by, queryType="instant", optional=True),
            line("route_trend", "Тренд", f"sum by ({by}) (rate({SRV}_count{{{HTTP}}}[5m]))", "req/s",
                 metricName=by, optional=True),
        ],
    }


def http_deps():
    by = "server_address"
    sel = SEL
    return {
        "name": "http_deps", "title": "Исходящие HTTP", "layout": "table",
        "description": "http_client_* · среднее за период",
        "graphs": [
            stat("out_rps", "Запросы", f"sum by ({by}) (rate({CLI}_count{{{sel}}}[{D}]))", "req/s",
                 metricName=by, queryType="instant", optional=True),
            stat("out_5xx", "5xx",
                 f'100 * (sum by ({by}) (rate({CLI}_count{{{sel}, http_response_status_code=~"5.."}}[{D}])) '
                 f"or 0 * sum by ({by}) (rate({CLI}_count{{{sel}}}[{D}]))) / sum by ({by}) (rate({CLI}_count{{{sel}}}[{D}]))",
                 "%", metricName=by, queryType="instant", warnAbove=1, optional=True),
            stat("out_p90", "p90", quantile(0.9, CLI, by, D, sel), "s", metricName=by, queryType="instant", optional=True),
            stat("out_queue_p90", "Ожидание соединения p90",
                 quantile(0.9, "http_client_request_time_in_queue_seconds", by, D, sel), "s",
                 metricName=by, queryType="instant", optional=True),
            line("out_trend", "Тренд", f"sum by ({by}) (rate({CLI}_count{{{sel}}}[5m]))", "req/s",
                 metricName=by, optional=True),
        ],
    }


def graph_deps():
    by = "server"
    sel = 'client="{{.resource}}"'
    return {
        "name": "graph_deps", "title": "Зависимости по трейсам", "layout": "table",
        "description": "service graph · Redis, БД, Kafka и другие сервисы · среднее за период",
        "graphs": [
            stat("dep_rps", "Запросы", f"sum by ({by}) (rate({SG}_total{{{sel}}}[{D}]))", "req/s",
                 metricName=by, queryType="instant", optional=True),
            stat("dep_errors", "Ошибки",
                 f"100 * (sum by ({by}) (rate({SG}_failed_total{{{sel}}}[{D}])) or 0 * sum by ({by}) (rate({SG}_total{{{sel}}}[{D}]))) "
                 f"/ sum by ({by}) (rate({SG}_total{{{sel}}}[{D}]))",
                 "%", metricName=by, queryType="instant", warnAbove=1, optional=True),
            stat("dep_p90", "p90", f"histogram_quantile(0.9, sum by (le, {by}) (rate({SG}_server_seconds_bucket{{{sel}}}[{D}])))",
                 "s", metricName=by, queryType="instant", optional=True),
            line("dep_trend", "Тренд", f"sum by ({by}) (rate({SG}_total{{{sel}}}[5m]))", "req/s",
                 metricName=by, optional=True),
        ],
    }


def units(by, title, description):
    throttle_sel = f"{SEL}, {CONT}" if by == "container" else SEL
    return {
        "name": "units", "title": title, "layout": "units", "description": description,
        "graphs": [
            line("unit_cpu", "CPU", cpu(by), "cores", metricName=by, thresholds=[limit("cpu", by), request("cpu", by)]),
            line("unit_memory", "Память", mem(by), "bytes", metricName=by, thresholds=[limit("memory", by), request("memory", by)]),
            stat("unit_throttling", "Throttling",
                 f"100 * sum by ({by}) (rate(container_cpu_cfs_throttled_periods_total{{{throttle_sel}}}[{D}])) "
                 f"/ sum by ({by}) (rate(container_cpu_cfs_periods_total{{{throttle_sel}}}[{D}]))",
                 "%", metricName=by, queryType="instant", warnAbove=5),
            stat("unit_restarts", "Рестарты", f"sum by ({by}) (increase(kube_pod_container_status_restarts_total{{{SEL}}}[{D}]))",
                 "count", metricName=by, queryType="instant", warnAbove=0),
            stat("unit_probes", "Probe L/R/S",
                 f'sum by ({by}, probe_type) (increase(prober_probe_total{{{SEL}, result="failed"}}[{D}]))',
                 "count", metricName=by, queryType="instant", splitBy="probe_type", warnAbove=0),
            {
                "name": "unit_last_reason", "title": "Последнее завершение", "graphType": "note", "metricName": by,
                "queryType": "instant", "splitBy": "reason",
                "queryExpression": f"max by ({by}, reason) (kube_pod_container_status_last_terminated_reason{{{SEL}}}) > 0",
            },
        ],
    }


def resource_charts(by, suffix):
    return {
        "name": "resource_charts", "title": "Ресурсы",
        "graphs": [
            line("cpu_chart", f"CPU {suffix}", cpu(by), "cores", metricName=by, span=6,
                 thresholds=[limit("cpu", by), request("cpu", by)]),
            line("memory_chart", f"Память {suffix}", mem(by), "bytes", metricName=by, span=6,
                 thresholds=[limit("memory", by)]),
        ],
    }


def fit(resource, title, usage, unit):
    # Usage of the busiest pod for each container, sampled every 5 minutes over 7 days.
    worst = f"max by (container) ({usage})"
    req = f'max by (container) (kube_pod_container_resource_requests{{{SEL}, resource="{resource}"}})'
    lim = f'max by (container) (kube_pod_container_resource_limits{{{SEL}, resource="{resource}"}})'

    def g(role, title_, q, u=unit):
        return stat(f"fit_{resource}_{role}", title_, q, u, metricName="container", queryType="instant", role=role)

    return {
        "name": f"fit_{resource}", "title": title, "layout": "fit",
        "description": "все поды · по контейнерам · за 7 дней (или меньше, если Prometheus хранит меньше)",
        "graphs": [
            g("p50", "p50", f"quantile_over_time(0.5, ({worst})[7d:5m])"),
            g("p95", "p95", f"quantile_over_time(0.95, ({worst})[7d:5m])"),
            g("max", "max", f"max_over_time(({worst})[7d:5m])"),
            g("request", "request", req),
            g("limit", "limit", lim),
            g("above", "Выше request", f"100 * avg_over_time(({worst} > bool on (container) {req})[7d:5m])", u="%"),
        ],
    }


CPU_USAGE = f"sum by (container, pod) (rate(container_cpu_usage_seconds_total{{{SEL}, {CONT}}}[5m]))"
MEM_USAGE = f"sum by (container, pod) (container_memory_working_set_bytes{{{SEL}, {CONT}}})"

WORKLOAD_ROWS = [
    kpi("pod"),
    http_charts(),
    routes(),
    http_deps(),
    graph_deps(),
    units("pod", "Поды", "сумма по контейнерам пода · полоса = % от limit, черта = request"),
    resource_charts("pod", "по подам"),
    fit("cpu", "CPU: request против потребления", CPU_USAGE, "cores"),
    fit("memory", "Память: request против потребления", MEM_USAGE, "bytes"),
]

POD_ROWS = [
    kpi("container"),
    http_charts(),
    routes(),
    http_deps(),
    units("container", "Контейнеры", "полоса = % от limit, черта = request"),
    resource_charts("container", "по контейнерам"),
]

INTERVALS = ["15m", "1h", "6h", "24h"]


def dashboard(kind, rows):
    return {"groupKind": kind, "intervals": INTERVALS, "rows": rows}


config = {
    "prometheus": {
        "applications": [
            {
                "name": "default",
                "default": True,
                "dashboards": [dashboard(k, WORKLOAD_ROWS) for k in ("deployment", "rollout", "statefulset")]
                + [dashboard("pod", POD_ROWS)],
            }
        ],
        "provider": {"Name": "default", "default": True, "address": PROMETHEUS},
    }
}

text = json.dumps(config, ensure_ascii=False, indent=2) + "\n"


def indent(t, n):
    pad = " " * n
    return "".join(pad + line if line.strip() else line for line in t.splitlines(True))


with open(os.path.join(ROOT, "app", "config.json"), "w", encoding="utf-8") as f:
    f.write(text)

with open(os.path.join(ROOT, "manifests", "configmap.yaml"), "w", encoding="utf-8") as f:
    f.write(
        "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: argocd-metrics-server-configmap\n"
        "data:\n  config.json: |\n" + indent(text, 4)
    )

# Item for Helm `extraObjects` (same indentation as the previous cm.yaml).
with open(os.path.join(ROOT, "cm.yaml"), "w", encoding="utf-8") as f:
    f.write(
        "  - apiVersion: v1\n    kind: ConfigMap\n    metadata:\n      name: argocd-metrics-server-configmap\n"
        "    data:\n      config.json: |\n" + indent(text, 8)
    )

print("written cm.yaml, manifests/configmap.yaml, app/config.json")
