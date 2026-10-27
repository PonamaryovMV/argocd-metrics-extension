package server

import (
	"fmt"

	"github.com/prometheus/common/config"
)

type Threshold struct {
	Key             string `json:"key"`
	Name            string `json:"name"`
	Color           string `json:"color"`
	Value           string `json:"value"`
	Unit            string `json:"unit"`
	QueryExpression string `json:"queryExpression"`
}

type Graph struct {
	Name            string      `json:"name"`
	Title           string      `json:"title"`
	Description     string      `json:"description"`
	GraphType       string      `json:"graphType"`
	MetricName      string      `json:"metricName"`
	ColorSchemes    []string    `json:"colorSchemes"`
	Thresholds      []Threshold `json:"thresholds"`
	QueryExpression string      `json:"queryExpression"`
	YAxisUnit       string      `json:"yAxisUnit"`
	ValueRounding   int         `json:"valueRounding"`
	// Span is the card width in a 12-column grid (UI only).
	Span int `json:"span,omitempty"`
	// GoodDirection tells stat tiles whether growth is good ("up") or bad ("down") (UI only).
	GoodDirection string `json:"goodDirection,omitempty"`
	// Group joins neighbouring stat tiles into one split KPI cell (UI only).
	Group string `json:"group,omitempty"`
}

type Row struct {
	Name   string   `json:"name"`
	Title  string   `json:"title"`
	Tab    string   `json:"tab"`
	Graphs []*Graph `json:"graphs"`
}

func (r *Row) getGraph(name string) *Graph {
	for _, graph := range r.Graphs {
		if graph.Name == name {
			return graph
		}
	}
	return nil
}

type Dashboard struct {
	Name         string   `json:"name"`
	GroupKind    string   `json:"groupKind"`
	RefreshRate  string   `json:"refreshRate"`
	Tabs         []string `json:"tabs"`
	Rows         []*Row   `json:"rows"`
	ProviderType string   `json:"providerType"`
	Intervals    []string `json:"intervals"`
	// GrafanaURL is an optional link template shown in the UI header,
	// e.g. https://grafana/d/abc?var-namespace={{.namespace}}&from={{.from}}&to={{.to}}
	GrafanaURL string `json:"grafanaUrl,omitempty"`
	// ShowPods toggles the pods table under the charts (default: shown).
	ShowPods *bool `json:"showPods,omitempty"`
}

func (d *Dashboard) getRow(name string) *Row {
	for _, row := range d.Rows {
		if row.Name == name {
			return row
		}
	}
	return nil
}

type Application struct {
	Name             string       `json:"name"`
	Default          bool         `json:"default"`
	DefaultDashboard *Dashboard   `json:"defaultDashboard"`
	Dashboards       []*Dashboard `json:"dashboards"`
}

func (a Application) getDashBoard(groupKind string) *Dashboard {
	for _, dash := range a.Dashboards {
		fmt.Println(dash.GroupKind, groupKind)
		if dash.GroupKind == groupKind {
			return dash
		}
	}
	return a.DefaultDashboard
}

type provider struct {
	Name      string           `json:"name"`
	Address   string           `json:"address"`
	Default   bool             `json:"default"`
	TLSConfig config.TLSConfig `json:"TLSConfig"`
}

type MetricsConfigProvider struct {
	Applications []Application `json:"applications"`
	Provider     provider      `json:"provider"`
}

func (p *MetricsConfigProvider) getApp(name string) *Application {
	var defaultApp Application
	for _, app := range p.Applications {
		if app.Name == name {
			return &app
		}
		if app.Default {
			defaultApp = app
		}
	}
	return &defaultApp
}

type O11yConfig struct {
	Prometheus *MetricsConfigProvider `json:"prometheus"`
	Wavefront  *MetricsConfigProvider `json:"wavefront"`
}
