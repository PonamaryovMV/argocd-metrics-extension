package server

import (
	"bytes"
	"github.com/stretchr/testify/assert"
	"testing"
	"text/template"
	"time"
)

func TestExpression(t *testing.T) {
	tmpl, err := template.New("query").Parse("sum(rate(container_cpu_usage_seconds_total{pod=~\"{{.name}}\", image!=\"\", container!=\"\", container_name!=\"POD\"}[5m])) by (container)")
	assert.NoError(t, err)
	env := map[string][]string{
		"name": []string{"rollout-ref-deployment.*"},
	}
	buf := new(bytes.Buffer)
	err = tmpl.Execute(buf, env)
	assert.NoError(t, err)
}

func TestQueryStep(t *testing.T) {
	cases := map[time.Duration]time.Duration{
		15 * time.Minute: 15 * time.Second,
		time.Hour:        15 * time.Second,
		6 * time.Hour:    90 * time.Second,
		24 * time.Hour:   6 * time.Minute,
	}
	for d, want := range cases {
		if got := queryStep(d); got != want {
			t.Errorf("queryStep(%s) = %s, want %s", d, got, want)
		}
	}
}
