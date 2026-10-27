#!/usr/bin/env python3
"""Generates app/config.json and manifests/configmap.yaml for the new Metrics UI.

One dashboard definition is reused for every workload kind. Edit the queries
below (label names, metric names) to match your Prometheus, then run:

    python3 hack/gen-dashboard-config.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Label selectors. {{.namespace}} and {{.name}} are filled in by the metrics server
# from the selected resource (name is "<resource-name>.*", so it matches its pods).
SEL = 'namespace="{{.namespace}}", pod=~"{{.name}}"'
CONTAINER = 'container!="", container!="POD"'

# HTTP server metrics from OpenTelemetry (semantic conventions, Prometheus naming).
HTTP = "http_server_request_duration_seconds"
STATUS = "http_response_status_code"


def limit(resource, by=""):
    agg = f"sum by (pod)" if by == "pod" else "sum"
    return {
        "key": "limit",
        "name": "limit",
        "queryExpression": f'{agg} (kube_pod_container_resource_limits{{{SEL}, resource="{resource}"}})',
    }


def request(resource):
    return {
        "key": "request",
        "name": "request",
        "queryExpression": f'sum by (pod) (kube_pod_container_resource_requests{{{SEL}, resource="{resource}"}})',
    }


def quantile(q, label):
    return (
        f'label_replace(histogram_quantile({q}, sum by (le) (rate({HTTP}_bucket{{{SEL}}}[5m]))), '
        f'"quantile", "{label}", "", "")'
    )


CPU_SUM = f"sum(rate(container_cpu_usage_seconds_total{{{SEL}, {CONTAINER}}}[5m]))"
MEM_SUM = f"sum(container_memory_working_set_bytes{{{SEL}, {CONTAINER}}})"
CPU_BY_POD = f"sum by (pod) (rate(container_cpu_usage_seconds_total{{{SEL}, {CONTAINER}}}[5m]))"
MEM_BY_POD = f"sum by (pod) (container_memory_working_set_bytes{{{SEL}, {CONTAINER}}})"

cpu_by_pod = {
    "name": "cpu_by_pod",
    "title": "CPU по подам",
    "description": "container_cpu_usage_seconds_total · cores",
    "graphType": "line",
    "metricName": "pod",
    "yAxisUnit": "cores",
    "queryExpression": CPU_BY_POD,
    "thresholds": [limit("cpu", by="pod"), request("cpu")],
}
mem_by_pod = {
    "name": "memory_by_pod",
    "title": "Память по подам",
    "description": "container_memory_working_set_bytes",
    "graphType": "line",
    "metricName": "pod",
    "yAxisUnit": "bytes",
    "queryExpression": MEM_BY_POD,
    "thresholds": [limit("memory", by="pod")],
}

def full(graph):
    """One chart per row, full width."""
    return {"name": graph["name"], "title": graph["title"], "graphs": [dict(graph, span=12)]}


rows = [
    {
        "name": "kpi",
        "title": "Ключевые показатели",
        "graphs": [
            {
                "name": "requests",
                "title": "Запросы",
                "graphType": "stat",
                "yAxisUnit": "req/s",
                "goodDirection": "up",
                "queryExpression": f"sum(rate({HTTP}_count{{{SEL}}}[1m]))",
            },
            {
                "name": "latency_p99",
                "title": "Latency p99",
                "graphType": "stat",
                "yAxisUnit": "s",
                "goodDirection": "down",
                "colorSchemes": ["#C2410C"],
                "queryExpression": f"histogram_quantile(0.99, sum by (le) (rate({HTTP}_bucket{{{SEL}}}[5m])))",
            },
            {
                "name": "errors_5xx",
                "title": "Ошибки 5xx",
                "graphType": "stat",
                "yAxisUnit": "%",
                "goodDirection": "down",
                "colorSchemes": ["#B42318"],
                "queryExpression": (
                    f'100 * (sum(rate({HTTP}_count{{{SEL}, {STATUS}=~"5.."}}[5m])) or vector(0))'
                    f" / sum(rate({HTTP}_count{{{SEL}}}[5m]))"
                ),
            },
            {
                "name": "cpu",
                "title": "CPU",
                "graphType": "stat",
                "yAxisUnit": "cores",
                "colorSchemes": ["#0E8A96"],
                "queryExpression": CPU_SUM,
                "thresholds": [limit("cpu")],
            },
            {
                "name": "memory",
                "title": "Память",
                "graphType": "stat",
                "yAxisUnit": "bytes",
                "colorSchemes": ["#7C3AED"],
                "queryExpression": MEM_SUM,
                "thresholds": [limit("memory")],
            },
            {
                "name": "saturation_memory",
                "title": "Память · limit",
                "group": "Насыщение",
                "graphType": "stat",
                "yAxisUnit": "bytes",
                "colorSchemes": ["#7C3AED"],
                "queryExpression": MEM_SUM,
                "thresholds": [limit("memory")],
            },
            {
                "name": "saturation_cpu",
                "title": "CPU · limit",
                "group": "Насыщение",
                "graphType": "stat",
                "yAxisUnit": "cores",
                "colorSchemes": ["#0E8A96"],
                "queryExpression": CPU_SUM,
                "thresholds": [limit("cpu")],
            },
        ],
    },
    full(
        {
            "name": "latency",
            "title": "Latency",
            "description": "histogram_quantile · http_server_request_duration_seconds",
            "graphType": "line",
            "metricName": "quantile",
            "yAxisUnit": "s",
            "colorSchemes": ["#1E40AF", "#3B82F6", "#C2410C"],
            "queryExpression": " or ".join([quantile(0.5, "p50"), quantile(0.95, "p95"), quantile(0.99, "p99")]),
            "thresholds": [{"key": "slo", "name": "порог 400 мс", "value": "0.4"}],
        }
    ),
    full(
        {
            "name": "traffic_by_code",
            "title": "Трафик по статусам",
            "description": "rate(http_server_request_duration_seconds_count[1m]) by code",
            "graphType": "bar",
            "metricName": "code",
            "yAxisUnit": "req/s",
            "queryExpression": (
                f'sum by (code) (label_replace(rate({HTTP}_count{{{SEL}}}[1m]), '
                f'"code", "${{1}}xx", "{STATUS}", "(.).."))'
            ),
        }
    ),
    full(cpu_by_pod),
    full(mem_by_pod),
]


def dashboard(kind):
    return {
        "groupKind": kind,
        # The UI is static: the first interval is the fixed time window.
        "intervals": ["1h"],
        "rows": rows,
    }


config = {
    "prometheus": {
        "provider": {
            "Name": "default",
            "default": True,
            "address": "http://prometheus-operated.monitoring.svc.cluster.local:9090",
        },
        "applications": [
            {
                "name": "default",
                "default": True,
                "dashboards": [dashboard(k) for k in ("deployment", "rollout", "statefulset", "pod")],
            }
        ],
    }
}

text = json.dumps(config, ensure_ascii=False, indent=2) + "\n"
with open(os.path.join(ROOT, "app", "config.json"), "w", encoding="utf-8") as f:
    f.write(text)

indented = "".join("    " + line if line.strip() else line for line in text.splitlines(True))
yaml = (
    "apiVersion: v1\n"
    "kind: ConfigMap\n"
    "metadata:\n"
    "  name: argocd-metrics-server-configmap\n"
    "data:\n"
    "  config.json: |\n" + indented
)
with open(os.path.join(ROOT, "manifests", "configmap.yaml"), "w", encoding="utf-8") as f:
    f.write(yaml)
print("written app/config.json and manifests/configmap.yaml")
