"use client";

import { useEffect, useRef, useState } from "react";
import type { DayStatsRow } from "@/lib/analytics/stats";
import { formatCount, formatDay } from "./format";
import { METRICS, metricValue, type Metric } from "./metrics";

const HEIGHT = 240;
const MARGIN = { top: 20, right: 4, bottom: 24, left: 36 };
const MAX_BAR_WIDTH = 24;
const BAR_GAP = 2;
const MIN_LABEL_SPACING = 56;

// Round the axis up to 1, 2 or 5 × 10^k with about four ticks.
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough)!;
  const ticks: number[] = [];
  for (let t = 0; t < max + step / 2; t += step) ticks.push(Number(t.toFixed(6)));
  if (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step);
  return ticks;
}

function formatTick(n: number): string {
  if (n >= 1000) return `${Number((n / 1000).toFixed(1))}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// Column path with a 4px rounded top and square base.
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h}`,
    "Z",
  ].join("");
}

export default function DailyChart({ days }: { days: DayStatsRow[] }) {
  const [metric, setMetric] = useState<Metric>(METRICS[0]!);
  const [hovered, setHovered] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const values = days.map((d) => metricValue(d, metric));
  const ticks = niceTicks(Math.max(...values));
  const yMax = ticks[ticks.length - 1]!;

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = days.length ? plotWidth / days.length : 0;
  const barWidth = Math.max(1, Math.min(MAX_BAR_WIDTH, band - BAR_GAP));
  const y = (v: number) => MARGIN.top + plotHeight - (v / yMax) * plotHeight;
  const bandX = (i: number) => MARGIN.left + i * band;

  const peakIndex = values.indexOf(Math.max(...values));
  const labelEvery = Math.max(1, Math.ceil(MIN_LABEL_SPACING / band));

  function handlePointer(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left) / band);
    setHovered(i >= 0 && i < days.length ? i : null);
  }

  // The tooltip sits beside the hovered column, on whichever side has room.
  const hoveredDay = hovered !== null ? days[hovered] : undefined;
  const flipTooltip = hovered !== null && bandX(hovered) + band / 2 > width / 2;
  const tooltipStyle =
    hovered === null
      ? undefined
      : flipTooltip
        ? { right: width - bandX(hovered) + 8, top: MARGIN.top }
        : { left: bandX(hovered) + band + 8, top: MARGIN.top };

  return (
    <section className="stats-card">
      <div className="stats-chart-head">
        <h2>{metric.label} by day</h2>
        <div className="stats-tabs" role="group" aria-label="Metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={m.key === metric.key}
              onClick={() => setMetric(m)}
            >
              {m.key === "visitors" ? "Visitors" : m.label.replace(" per visitor", "")}
            </button>
          ))}
        </div>
      </div>

      <div className="stats-chart" ref={containerRef}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={`${metric.label} by day`}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "var(--axis)" : "var(--grid)"}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                  {formatTick(t)}
                </text>
              </g>
            ))}

            {hovered !== null && (
              <rect
                x={bandX(hovered)}
                y={MARGIN.top}
                width={band}
                height={plotHeight}
                fill="var(--wash)"
              />
            )}

            {values.map((v, i) => {
              const h = y(0) - y(v);
              return h > 0 ? (
                <path
                  key={days[i]!.date}
                  d={columnPath(bandX(i) + (band - barWidth) / 2, y(v), barWidth, h)}
                  fill="var(--series-1)"
                />
              ) : null;
            })}

            {values[peakIndex]! > 0 && (
              <text
                className="peak-label"
                x={bandX(peakIndex) + band / 2}
                y={y(values[peakIndex]!) - 6}
                textAnchor="middle"
              >
                {metric.format(values[peakIndex]!)}
              </text>
            )}

            {days.map((d, i) =>
              (days.length - 1 - i) % labelEvery === 0 ? (
                <text
                  key={d.date}
                  x={bandX(i) + band / 2}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                >
                  {formatDay(d.date)}
                </text>
              ) : null
            )}

            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              onPointerMove={handlePointer}
              onPointerDown={handlePointer}
              onPointerLeave={() => setHovered(null)}
            />
          </svg>
        )}

        {hoveredDay && (
          <div className="stats-tooltip" style={tooltipStyle}>
            <div className="stats-tooltip-date">{formatDay(hoveredDay.date, true)}</div>
            <dl>
              {METRICS.map((m) => (
                <div key={m.key} className={m.key === metric.key ? "active" : ""}>
                  <dt>{m.label}</dt>
                  <dd>{m.format(metricValue(hoveredDay, m))}</dd>
                </div>
              ))}
              <dt>Visits · played · solved</dt>
              <dd>
                {formatCount(hoveredDay.visits)} · {formatCount(hoveredDay.rounds)} ·{" "}
                {formatCount(hoveredDay.solved)}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
