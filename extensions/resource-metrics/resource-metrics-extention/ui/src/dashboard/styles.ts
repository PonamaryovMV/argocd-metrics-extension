// Styles are injected at runtime so the bundle needs no CSS/SASS loaders. Everything is scoped under .mx-root.
const CSS = `
.mx-root{
  --mx-bg:#F4F6F9; --mx-card:#FFFFFF; --mx-border:#E5E8EE; --mx-border-strong:#D5DAE3; --mx-line:#EEF1F5;
  --mx-text:#111827; --mx-muted:#5B6472; --mx-soft:#6B7280;
  --mx-teal:#0E8A96; --mx-teal-bg:#E6F7F8; --mx-teal-dark:#0B5E66;
  --mx-blue-bg:#E8F0FD; --mx-blue-dark:#1D4FA8;
  --mx-green:#18A058; --mx-green-bg:#E7F6EE; --mx-green-dark:#11663B;
  --mx-amber:#F08A24; --mx-amber-bg:#FEF3E2; --mx-amber-dark:#B45309;
  --mx-red:#B42318; --mx-red-bg:#FDECE7;
  --mx-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --mx-sh:0 1px 3px rgba(16,24,40,.07),0 1px 2px rgba(16,24,40,.04);
  background:var(--mx-bg); color:var(--mx-text);
  font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  font-size:14px; line-height:1.45; font-variant-numeric:tabular-nums;
  border-radius:8px; overflow:hidden; text-align:left;
}
.mx-root *,.mx-root *::before,.mx-root *::after{box-sizing:border-box}
.mx-root button{font-family:inherit;cursor:pointer}
.mx-root h2,.mx-root h3,.mx-root p{margin:0}
.mx-mono{font-family:var(--mx-mono);font-size:12px}
.mx-muted{color:var(--mx-muted)}
.mx-small{font-size:12px}
.mx-sans{font-family:inherit!important}
.mx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* header */
.mx-header{background:var(--mx-card);border-bottom:1px solid var(--mx-border);padding:18px 24px}
.mx-period{display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-size:12px;color:var(--mx-muted)}
.mx-period b{font-size:13px;color:var(--mx-text);font-weight:600}
.mx-header__top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}
.mx-ident{display:flex;align-items:center;gap:14px;min-width:0}
.mx-logo{width:40px;height:40px;flex:none;border-radius:10px;background:linear-gradient(135deg,#0E8A96,#0F8C84);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(14,138,150,.25)}
.mx-ident__row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mx-ident__name{font-size:19px;font-weight:700;letter-spacing:-.015em;color:var(--mx-text)}
.mx-ident__meta{color:var(--mx-muted);font-size:13px;margin-top:2px}
.mx-ident__meta code{font-family:var(--mx-mono);font-size:12.5px;color:#374151;background:none;padding:0}
.mx-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:var(--mx-line);color:#4B5563;white-space:nowrap}
.mx-pill i{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block}
.mx-pill.is-ok{background:var(--mx-green-bg);color:var(--mx-green-dark)}
.mx-pill.is-ok i{background:var(--mx-green)}
.mx-pill.is-info{background:var(--mx-blue-bg);color:var(--mx-blue-dark)}
.mx-pill.is-warn{background:var(--mx-amber-bg);color:var(--mx-amber-dark)}
.mx-pill.is-bad{background:var(--mx-red-bg);color:var(--mx-red)}
.mx-pill--sync{background:var(--mx-teal-bg);color:var(--mx-teal-dark);border-radius:6px;font-size:11.5px}
.mx-header__bar{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:16px}
.mx-tabs{display:flex;gap:2px;flex-wrap:wrap}
.mx-tab{position:relative;height:44px;padding:0 16px;border:0;background:none;font-size:14px;font-weight:500;color:var(--mx-muted);transition:color .15s}
.mx-tab:hover{color:var(--mx-text)}
.mx-tab.is-active{color:var(--mx-text);font-weight:600}
.mx-tab.is-active::after{content:'';position:absolute;left:8px;right:8px;bottom:-1px;height:2px;border-radius:2px;background:var(--mx-teal)}
.mx-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mx-updated{font-size:12px;color:var(--mx-muted);min-width:64px}
.mx-seg{display:flex;padding:3px;background:var(--mx-line);border-radius:9px;gap:2px}
.mx-seg button{height:32px;padding:0 12px;border:0;border-radius:7px;background:transparent;font-size:13px;font-weight:500;color:#4B5563;transition:all .12s}
.mx-seg button:hover{color:var(--mx-text)}
.mx-seg button.is-active{background:var(--mx-card);box-shadow:0 1px 2px rgba(16,24,40,.12);font-weight:600;color:var(--mx-text)}
.mx-seg--sm{padding:2px;border-radius:7px}
.mx-seg--sm button{height:26px;padding:0 9px;font-size:12px;border-radius:5px}
.mx-btn{height:38px;display:inline-flex;align-items:center;gap:8px;padding:0 13px;border:1px solid var(--mx-border-strong);border-radius:8px;background:var(--mx-card);color:#374151;font-size:13px;font-weight:500;text-decoration:none;transition:all .15s}
.mx-btn:hover{border-color:#B8BFCB;background:#FAFBFC;color:var(--mx-text);text-decoration:none}
.mx-btn--icon{width:38px;padding:0;justify-content:center}
.mx-btn--icon.is-spinning svg{animation:mx-spin .8s linear infinite}
.mx-live{width:7px;height:7px;border-radius:50%;background:#9CA3AF}
.mx-btn--toggle.is-on .mx-live{background:var(--mx-green);box-shadow:0 0 0 3px rgba(24,160,88,.15)}
@keyframes mx-spin{to{transform:rotate(360deg)}}

/* layout */
.mx-main{padding:20px 24px 24px;display:flex;flex-direction:column;gap:16px}
.mx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px}
.mx-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}
.mx-cell{min-width:0;display:flex}
.mx-cell>*{flex:1;min-width:0}
${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `.mx-span-${n}{grid-column:span ${n}}`).join("")}
@media (max-width:1100px){.mx-cell{grid-column:span 12}}

/* kpi */
.mx-kpi{background:var(--mx-card);border:1px solid var(--mx-border);border-radius:12px;padding:16px 16px 14px;display:flex;flex-direction:column;gap:10px;min-width:0;transition:border-color .2s,box-shadow .2s;animation:mx-rise .4s ease both}
.mx-kpi:hover{border-color:var(--mx-border-strong);box-shadow:var(--mx-sh)}
.mx-kpi__head{display:flex;justify-content:space-between;align-items:center;gap:6px;min-width:0}
.mx-kpi__label{color:var(--mx-muted);font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mx-kpi__value{display:flex;align-items:baseline;gap:5px;min-width:0}
.mx-kpi__value b{font-size:28px;font-weight:700;letter-spacing:-.03em;line-height:1;white-space:nowrap}
.mx-kpi__value span{color:var(--mx-muted);font-size:12.5px}
.mx-kpi__bar{display:flex;flex-direction:column;gap:6px;margin-top:auto}
.mx-kpi__foot{display:flex;justify-content:space-between;gap:6px;font-size:11.5px;color:var(--mx-muted)}
.mx-kpi__error{color:var(--mx-muted);font-size:13px;padding:14px 0}
.mx-badge{font-size:11.5px;font-weight:600;padding:2px 7px;border-radius:999px;white-space:nowrap;flex:none;background:var(--mx-line);color:#4B5563}
.mx-badge.is-ok{background:var(--mx-green-bg);color:var(--mx-green-dark)}
.mx-badge.is-bad{background:var(--mx-red-bg);color:var(--mx-red)}
.mx-badge.is-warn{background:var(--mx-amber-bg);color:var(--mx-amber-dark)}
.mx-kpi-split{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:0}
.mx-kpi--compact{padding:12px 10px 10px;gap:6px}
.mx-kpi--compact .mx-kpi__head{flex-wrap:wrap;gap:4px;align-items:flex-start}
.mx-kpi--compact .mx-kpi__label{font-size:11px;white-space:normal;line-height:1.2}
.mx-kpi--compact .mx-badge{font-size:10px;padding:1px 6px}
.mx-kpi--compact .mx-kpi__value b{font-size:22px}
.mx-kpi--compact .mx-kpi__value span{font-size:11px}
.mx-kpi--compact .mx-kpi__foot{font-size:10.5px}
.mx-kpi__foot b{color:var(--mx-text);font-weight:600;font-family:var(--mx-mono);font-size:11px}
.mx-track{height:8px;background:var(--mx-line);border-radius:999px;overflow:hidden}
.mx-track--thin{height:6px}
.mx-fill{height:100%;border-radius:999px;transition:width .5s ease}
.mx-spark{display:block;width:100%;margin:0 -2px -4px}

/* cards */
.mx-card{background:var(--mx-card);border:1px solid var(--mx-border);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:12px;min-width:0;animation:mx-rise .4s ease both}
.mx-card--flush{padding:0;gap:0;overflow:hidden}
.mx-card__head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.mx-card__titles{min-width:0}
.mx-card__title{font-size:15px;font-weight:600;letter-spacing:-.005em;color:var(--mx-text)}
.mx-card__sub{color:var(--mx-muted);font-size:12px;font-family:var(--mx-mono);margin-top:2px;overflow-wrap:anywhere}
.mx-card__aside{display:flex;align-items:center;gap:12px}
.mx-card__value{font-size:18px;font-weight:700;letter-spacing:-.02em}
.mx-card__foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--mx-muted)}
.mx-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#374151}
.mx-legend__item{display:inline-flex;align-items:center;gap:6px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx-swatch{display:inline-block;width:10px;height:3px;border-radius:2px;flex:none}
.mx-swatch--block{width:10px;height:10px;border-radius:3px}
.mx-swatch--dashed{width:14px;height:0;border-top:2px dashed;border-radius:0;background:none}
.mx-empty{color:var(--mx-muted);font-size:13px;padding:24px 0;text-align:center;overflow-wrap:anywhere}
.mx-empty b{color:var(--mx-text)}
.mx-skeleton{border-radius:12px;background:linear-gradient(90deg,#EEF1F5 25%,#F7F8FA 37%,#EEF1F5 63%);background-size:400% 100%;animation:mx-shimmer 1.4s ease infinite}
@keyframes mx-shimmer{0%{background-position:100% 0}100%{background-position:0 0}}
@keyframes mx-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* charts */
.mx-chart{position:relative;width:100%;min-height:40px}
.mx-chart svg{display:block;overflow:visible}
.mx-chart .mx-gridline{stroke:#EEF1F5}
.mx-chart .mx-axis-base{stroke:#E5E8EE}
.mx-chart .mx-axis-label{font-size:11px;fill:#5B6472;font-family:var(--mx-mono)}
.mx-chart .mx-cursor{stroke:#5B6472;stroke-dasharray:3 3}
.mx-chart .mx-after-sync{fill:#0E8A96;opacity:.045}
.mx-chart .mx-line{animation:mx-draw 1s ease-out both}
@keyframes mx-draw{from{stroke-dasharray:4000;stroke-dashoffset:4000}to{stroke-dasharray:4000;stroke-dashoffset:0}}
.mx-marker line{stroke:#0E8A96;stroke-width:1.5}
.mx-marker rect{fill:#0E8A96}
.mx-marker text{fill:#fff;font-size:10px;font-weight:600;font-family:var(--mx-mono)}
.mx-tooltip{position:absolute;top:6px;transform:translateX(-50%);pointer-events:none;z-index:5;background:rgba(17,24,39,.96);color:#F9FAFB;padding:9px 11px;border-radius:8px;font-size:12px;font-weight:500;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.25);min-width:140px}
.mx-tooltip__label{color:rgba(249,250,251,.6);font-size:10.5px;font-weight:600;letter-spacing:.06em;margin-bottom:5px;font-family:var(--mx-mono)}
.mx-tooltip__row{display:flex;align-items:center;gap:7px;margin-top:2px}
.mx-tooltip__swatch{width:7px;height:7px;border-radius:50%;flex:none;border:0 solid}
.mx-tooltip__swatch.is-dashed{width:10px;height:0;border-radius:0;border-top-width:2px;border-top-style:dashed}
.mx-tooltip__name{color:rgba(249,250,251,.72);font-size:11.5px;max-width:240px;overflow:hidden;text-overflow:ellipsis}
.mx-tooltip__val{margin-left:auto;padding-left:14px;font-weight:600;font-family:var(--mx-mono)}
.mx-tooltip__note{margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);color:#7DD3DC;font-size:11.5px}

/* gauge */
.mx-gauge-wrap{display:flex;flex-direction:column;align-items:center;gap:4px}
.mx-gauge{width:100%;max-width:230px;display:block}
.mx-gauge__value{transition:stroke-dasharray .6s ease}
.mx-gauge__num{font-size:36px;font-weight:700;fill:#111827;letter-spacing:-.03em}
.mx-gauge__pct{font-size:15px;fill:#5B6472;font-weight:500}
.mx-gauge__cap{font-size:10px;font-weight:600;fill:#5B6472;letter-spacing:.08em}
.mx-gauge__tick{font-size:10px;fill:#5B6472}
.mx-gauge-legend{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;font-size:12px;color:var(--mx-muted);font-weight:500}
.mx-gauge-legend span{display:inline-flex;align-items:center;gap:5px}
.mx-gauge-legend i{width:7px;height:7px;border-radius:50%;display:inline-block}
.mx-satlist{display:flex;flex-direction:column;gap:12px;padding-top:14px;border-top:1px solid var(--mx-line);font-size:13px}
.mx-satlist__row{display:flex;flex-direction:column;gap:6px}
.mx-satlist__top{display:flex;justify-content:space-between;gap:8px;color:var(--mx-muted)}
.mx-satlist__top b{color:var(--mx-text)}

/* donut */
.mx-donut{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
.mx-donut__legend{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:12.5px;min-width:0}
.mx-donut__legend li{display:flex;align-items:center;gap:8px}
.mx-donut__name{color:var(--mx-muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* table */
.mx-table-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 18px;border-bottom:1px solid var(--mx-line)}
.mx-count{color:var(--mx-muted);font-weight:500;font-size:13px;margin-left:4px}
.mx-filter{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border:1px solid var(--mx-border-strong);border-radius:8px;color:var(--mx-muted);background:var(--mx-card);margin:0;font-weight:400}
.mx-filter:focus-within{border-color:var(--mx-teal);box-shadow:0 0 0 3px rgba(14,138,150,.12)}
.mx-filter input{border:0;outline:none;font:13px inherit;font-family:inherit;width:160px;color:var(--mx-text);background:transparent;padding:0;height:auto;box-shadow:none}
.mx-table-wrap{overflow-x:auto}
.mx-table{width:100%;border-collapse:collapse;min-width:860px;font-size:13px}
.mx-table th{text-align:left;color:var(--mx-muted);font-size:12px;font-weight:600;background:#FAFBFC;padding:10px 18px;border-bottom:1px solid var(--mx-line);white-space:nowrap}
.mx-table td{padding:12px 18px;border-top:1px solid var(--mx-line);vertical-align:middle}
.mx-table tbody tr:hover{background:#FAFBFC}
.mx-num{text-align:right}
.mx-pod{display:inline-flex;align-items:center;gap:8px;font-family:var(--mx-mono);font-size:12px}
.mx-pod__color{width:8px;height:8px;border-radius:2px;flex:none}
.mx-status{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:#4B5563}
.mx-status i{width:7px;height:7px;border-radius:50%;background:currentColor}
.mx-status.is-ok{color:var(--mx-green-dark)}
.mx-status.is-info{color:var(--mx-blue-dark)}
.mx-status.is-warn{color:var(--mx-amber-dark)}
.mx-status.is-bad{color:var(--mx-red)}
.mx-restarts{padding:2px 8px;border-radius:999px;background:#FFF1DB;color:#8A5300;font-weight:600;font-size:12px}
.mx-cellbar{display:flex;align-items:center;gap:8px}
.mx-cellbar .mx-track{flex:1;min-width:64px}
.mx-cellbar .mx-mono{min-width:58px;color:#374151}
.mx-podspark{width:80px}

.mx-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--mx-muted);font-size:12px;padding:2px}
.mx-state{display:flex;gap:14px;align-items:flex-start;padding:28px 24px;color:var(--mx-muted)}
.mx-state b{color:var(--mx-text)}
.mx-state p{margin-top:4px;overflow-wrap:anywhere}


/* sections */
.mx-section{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:4px 2px 10px}
.mx-section h3{font-size:15px;font-weight:700;color:var(--mx-text)}
.mx-section span{font-size:12px;color:var(--mx-muted)}
.mx-kpi__value.is-warn b{color:var(--mx-amber-dark)}
.mx-kpi__foot--wrap{white-space:normal;line-height:1.35}

/* units: card per pod / container */
.mx-units{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px}
.mx-unit{gap:12px}
.mx-unit__top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.mx-unit__name{display:flex;align-items:center;gap:8px;font-family:var(--mx-mono);font-size:12.5px;font-weight:600;min-width:0;overflow-wrap:anywhere}
.mx-unit__name i{width:9px;height:9px;border-radius:3px;flex:none}
.mx-m{display:grid;grid-template-columns:58px 1fr;gap:10px;align-items:start}
.mx-m__lbl{color:var(--mx-muted);font-size:12px;padding-top:4px}
.mx-m__body{min-width:0}
.mx-m__val{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.mx-m__val b{font-size:19px;letter-spacing:-.02em}
.mx-m__val span{color:var(--mx-muted);font-size:12px}
.mx-ubar{position:relative;height:6px;border-radius:999px;background:var(--mx-line);margin:6px 0 2px}
.mx-ubar i{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
.mx-ubar__req{position:absolute;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:#374151;border-radius:1px}
.mx-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:8px;border-top:1px solid var(--mx-line);padding-top:10px}
.mx-fact{font-size:11.5px;color:var(--mx-muted);min-width:0}
.mx-fact b{display:block;font-size:14px;color:var(--mx-text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mx-fact b.mx-mono{font-size:12px}
.mx-fact b.is-warn{color:var(--mx-amber-dark)}
.mx-note{font-size:12px;padding:6px 9px;border-radius:7px;background:var(--mx-amber-bg);color:var(--mx-amber-dark)}

/* tables */
.mx-table--compact{min-width:640px}
.mx-table--compact td{padding:10px 18px}
.mx-keycell{font-family:var(--mx-mono);font-size:12px;overflow-wrap:anywhere}
.mx-tspark{width:120px}
.mx-more{padding:8px 18px 12px;font-size:12px;color:var(--mx-muted);border-top:1px solid var(--mx-line)}

/* fit: requests vs usage */
.mx-fit-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--mx-muted);margin-bottom:4px}
.mx-fit-legend span{display:inline-flex;align-items:center;gap:6px}
.mx-fit-legend__band{display:inline-block;width:16px;height:10px;border-radius:3px;background:#BFDCE0}
.mx-fit-legend__p95{display:inline-block;width:3px;height:12px;background:var(--mx-teal)}
.mx-fit-legend__mk{display:inline-block;height:12px;border-left:2px solid}
.mx-fit{display:grid;grid-template-columns:minmax(150px,230px) 1fr 230px;gap:16px;align-items:center;padding:14px 0;border-top:1px solid var(--mx-line)}
.mx-fit-legend+.mx-fit{border-top:0}
@media (max-width:900px){.mx-fit{grid-template-columns:1fr}}
.mx-fit__name{font-family:var(--mx-mono);font-size:12.5px;font-weight:600;overflow-wrap:anywhere}
.mx-fit__out{font-size:12.5px}
.mx-fit__out b{font-size:14px}
.mx-range{position:relative;height:30px}
.mx-range__axis{position:absolute;left:0;right:0;top:14px;height:2px;background:var(--mx-line)}
.mx-range__band{position:absolute;top:9px;height:12px;border-radius:4px;background:#BFDCE0}
.mx-range__p95{position:absolute;top:5px;height:20px;width:3px;margin-left:-1px;background:var(--mx-teal);border-radius:2px}
.mx-range__max{position:absolute;top:8px;width:9px;height:14px;margin-left:-4px}
.mx-range__mk{position:absolute;top:-2px;bottom:-2px;width:0;border-left:2px solid}
.mx-range__mk span{position:absolute;top:-16px;left:-30px;width:60px;text-align:center;font:600 10px var(--mx-mono)}

@media (max-width:760px){
  .mx-header{padding:14px 16px}
  .mx-period{align-items:flex-start}
  .mx-main{padding:16px}
  .mx-tabs{overflow-x:auto;flex-wrap:nowrap;width:100%}
}
@media (prefers-reduced-motion:reduce){.mx-root *{animation:none!important;transition:none!important}}
`;

let injected = false;

export function injectStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-extension", "metrics");
  el.textContent = CSS;
  document.head.appendChild(el);
}
