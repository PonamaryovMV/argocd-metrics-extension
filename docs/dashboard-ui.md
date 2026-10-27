# Вкладка Metrics

Вкладка появляется в карточке `Deployment`, `Rollout`, `StatefulSet` и `Pod` в Argo CD. Набор блоков приходит из `argocd-metrics-server` по типу ресурса (`groupKind`).

- **Deployment / Rollout / StatefulSet** — все поды ресурса: сводка, эндпоинты, исходящие запросы, зависимости по трейсам, карточка на каждый под, графики CPU/памяти и «request против потребления» за 7 дней.
- **Pod** — один под: сводка, эндпоинты, исходящие запросы, карточка на каждый контейнер и графики по контейнерам.

Период выбирается в шапке (15м / 1ч / 6ч / 24ч). Блоки без данных (например, HTTP у воркера) скрываются.

## Какие метрики используются

Только общие, без привязки к языку:

| Блок | Метрики |
|---|---|
| Запросы, ошибки 5xx, latency, эндпоинты | `http_server_request_duration_seconds_*` (OpenTelemetry semconv) |
| Исходящие HTTP | `http_client_request_duration_seconds_*`, `http_client_request_time_in_queue_seconds_*` |
| Зависимости (Redis, БД, Kafka…) | `traces_service_graph_request_*` (service graph из трейсов, `client` = имя Deployment) |
| CPU, память, throttling | cAdvisor: `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`, `container_cpu_cfs_*` |
| request / limit, рестарты, причина завершения | kube-state-metrics |
| Неудачные probe | kubelet `/metrics/probes`: `prober_probe_total` |

Для Python-сервисов имена HTTP-метрик совпадут с .NET только при `OTEL_SEMCONV_STABILITY_OPT_IN=http` (задаётся в ресурсе `Instrumentation` OTel Operator).

Служебные маршруты (`/health*`, `/metrics`, `/scalar*`, `/openapi*`, `/swagger*` …) из HTTP-метрик исключены, список — `SKIP_ROUTES` в генераторе.

## Конфиг

Конфиг генерируется скриптом:

```sh
python3 hack/gen-dashboard-config.py
```

Он пишет три файла с одинаковым содержимым:

- `cm.yaml` — ConfigMap как элемент `extraObjects` Helm-чарта;
- `manifests/configmap.yaml` — обычный ConfigMap;
- `app/config.json` — для локального запуска.

Адрес Prometheus — константа `PROMETHEUS` в скрипте. После изменения ConfigMap перезапустите сервер: `kubectl -n argocd rollout restart deploy/argocd-metrics-server`.

### Подстановки в запросах

| Шаблон | Значение |
|---|---|
| `{{.namespace}}` | namespace ресурса |
| `{{.name}}` | `<имя-ресурса>.*` — все поды Deployment или один под |
| `{{.resource}}` | точное имя ресурса (для service graph) |
| `{{.duration}}` | выбранный период: `15m`, `1h`, `6h`, `24h` |

### Поля графика

| Поле | Что делает |
|---|---|
| `graphType` | `stat` (плитка/значение), `line`, `area`, `bar` (столбцы по сериям), `note` (плашка в карточке), `pie` |
| `queryType` | `range` (по умолчанию, за период) или `instant` (значение «сейчас»: сводки за период и 7-дневные квантили) |
| `metricName` | лейбл, по которому делятся серии (`pod`, `container`, `http_route` …) |
| `yAxisUnit` | `s`, `ms`, `bytes`, `bytes/s`, `%`, `cores`, `req/s`, `count` или любая подпись |
| `thresholds` | линии `limit` / `request`; в карточках дают «% от limit» и черту request |
| `splitBy` | значения лейбла выводятся отдельно (например, `probe_type` → «L / R / S») |
| `warnAbove` | подсветить значение, если оно больше числа |
| `goodDirection` | `up` / `down` — в какую сторону изменение за период считается хорошим |
| `optional` | скрыть, если данных нет |
| `span` | ширина карточки в сетке из 12 колонок |
| `role` | смысл графика в блоке `fit`: `p50`, `p95`, `max`, `request`, `limit`, `above` |

### Поля ряда

| Поле | Что делает |
|---|---|
| `layout` | `""` — плитки или графики; `units` — карточка на под/контейнер; `table` — таблица по ключу `metricName`; `fit` — request против потребления |
| `title`, `description` | заголовок и подпись блока |

## Сборка UI

```sh
cd extensions/resource-metrics/resource-metrics-extention/ui
yarn install --frozen-lockfile
yarn build            # → extension.tar
```

## Изменения в сервере

- Поля `queryType`, `splitBy`, `warnAbove`, `role`, `optional` у графика и `layout`, `description` у ряда.
- Мгновенные запросы (`queryType: instant`) выполняются через Prometheus `/api/v1/query`.
- UI дополнительно передаёт `resource` (точное имя ресурса), он доступен в шаблоне как `{{.resource}}`.
