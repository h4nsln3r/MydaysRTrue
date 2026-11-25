"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import { diffDaysISO, formatDayShort } from "@/lib/date";
import {
  FINANCE_CHART_SERIES,
  financeSeriesValue,
  formatKr,
  formatKrCompact,
  formatSignedKr,
  type FinanceChartSeriesKey,
  type MonthlyFinanceSnapshot,
} from "@/lib/monthly-finance";
import styles from "./FinanceYearChart.module.scss";

interface Props {
  snapshots: MonthlyFinanceSnapshot[];
  year: number;
  today: string;
}

const X_INSET = 2.5;
const Y_TOP = 8;
const Y_BOTTOM = 92;

function monthLabel(iso: string): string {
  return formatDayShort(iso).split(" ").slice(1).join(" ");
}

function moneyDomain(values: number[]): {
  min: number;
  max: number;
  ticks: number[];
} {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 1000);
  const rough = span / 3;
  const stepCandidates = [
    500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
    1_000_000, 2_000_000,
  ];
  const step = stepCandidates.find((candidate) => candidate + 1e-9 >= rough) ?? 5_000_000;
  const floorTo = (n: number) => Math.floor((n + 1e-9) / step) * step;
  const ceilTo = (n: number) => Math.ceil((n - 1e-9) / step) * step;
  let min = Math.max(0, floorTo(lo - span * 0.12));
  let max = ceilTo(hi + span * 0.18);
  if (max <= min) max = min + step;
  const count = Math.round((max - min) / step);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    ticks.push(min + i * step);
  }
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

function yearAxisLabels(year: number, axisEnd: string): { iso: string; text: string }[] {
  const labels: { iso: string; text: string }[] = [];
  for (let month = 1; month <= 12; month += 2) {
    const iso = `${year}-${String(month).padStart(2, "0")}-01`;
    if (iso <= axisEnd) labels.push({ iso, text: monthLabel(iso) });
  }
  const endMonth = `${axisEnd.slice(0, 7)}-01`;
  const last = labels[labels.length - 1];
  if (
    endMonth <= axisEnd &&
    (!last || (last.iso !== endMonth && diffDaysISO(last.iso, endMonth) >= 20))
  ) {
    labels.push({ iso: endMonth, text: monthLabel(endMonth) });
  }
  return labels;
}

function seriesMeta(key: FinanceChartSeriesKey) {
  return FINANCE_CHART_SERIES.find((series) => series.key === key)!;
}

export function FinanceYearChart({ snapshots, year, today }: Props) {
  const titleId = useId();
  const gradId = useId().replace(/:/g, "");
  const [activeKeys, setActiveKeys] = useState<FinanceChartSeriesKey[]>(["total"]);
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const axisEnd = today < yearEnd ? today : yearEnd;

  const points = useMemo(
    () =>
      snapshots
        .filter((snap) => snap.monthStart >= yearStart && snap.monthStart <= `${year}-12-01`)
        .slice()
        .sort((a, b) => a.monthStart.localeCompare(b.monthStart)),
    [snapshots, yearStart, year],
  );

  const visibleSeries = FINANCE_CHART_SERIES.filter((series) =>
    activeKeys.includes(series.key),
  );

  const toggleSeries = (key: FinanceChartSeriesKey) => {
    setActiveKeys((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  };

  const categoryStats = FINANCE_CHART_SERIES.map((series) => {
    const values = points
      .map((snap) => ({
        monthStart: snap.monthStart,
        value: financeSeriesValue(snap, series.key),
      }))
      .filter((row): row is { monthStart: string; value: number } => row.value != null);
    if (values.length === 0) return null;
    const first = values[0];
    const last = values[values.length - 1];
    return {
      series,
      first,
      last,
      delta: last.value - first.value,
      count: values.length,
    };
  }).filter((row): row is NonNullable<typeof row> => row != null);

  if (points.length === 0) {
    if (today < yearStart) return null;
    return (
      <section className={styles.card} aria-labelledby={titleId}>
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Ekonomi
            </h2>
            <p className={styles.kicker}>genom året</p>
          </div>
        </header>
        <p className={styles.empty}>
          Inga ekonomisaldon under året ännu. Fyll i under månadsvyn så syns
          kurvan här.
        </p>
      </section>
    );
  }

  const plottedValues = visibleSeries.flatMap((series) =>
    points
      .map((snap) => financeSeriesValue(snap, series.key))
      .filter((value): value is number => value != null),
  );
  const domain = moneyDomain(
    plottedValues.length > 0 ? plottedValues : [0, 1000],
  );
  const spanDays = Math.max(1, diffDaysISO(yearStart, axisEnd));

  const plotX = (iso: string) => {
    const t = diffDaysISO(yearStart, iso) / spanDays;
    return X_INSET + Math.min(1, Math.max(0, t)) * (100 - X_INSET * 2);
  };
  const plotY = (kr: number) => {
    const t = (domain.max - kr) / (domain.max - domain.min || 1);
    return Y_TOP + t * (Y_BOTTOM - Y_TOP);
  };

  const seriesPaths = visibleSeries.map((series) => {
    const plotted = points
      .map((snap) => {
        const value = financeSeriesValue(snap, series.key);
        if (value == null) return null;
        return {
          monthStart: snap.monthStart,
          value,
          x: plotX(snap.monthStart),
          y: plotY(value),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const line = plotted
      .map((point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
    const baseY = plotY(domain.min);
    const area =
      plotted.length > 1
        ? `${line} L${plotted[plotted.length - 1].x.toFixed(2)} ${baseY.toFixed(2)} L${plotted[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`
        : null;
    return { series, plotted, line, area };
  });

  const primaryKey = activeKeys.includes("total")
    ? "total"
    : activeKeys[0] ?? "total";
  const primaryStats = categoryStats.find((row) => row.series.key === primaryKey);
  const primaryDelta = primaryStats?.delta ?? 0;
  const deltaTone =
    primaryDelta > 50
      ? styles.deltaUp
      : primaryDelta < -50
        ? styles.deltaDown
        : styles.deltaFlat;

  const axisLabels = yearAxisLabels(year, axisEnd);
  const activeSnap = activeMonth != null ? points[activeMonth] : null;

  const selectAt = (clientX: number, width: number, left: number) => {
    const x = ((clientX - left) / width) * 100;
    let best = 0;
    let bestDist = Infinity;
    points.forEach((snap, index) => {
      const dist = Math.abs(plotX(snap.monthStart) - x);
      if (dist < bestDist) {
        best = index;
        bestDist = dist;
      }
    });
    setActiveMonth(best);
  };

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            Ekonomi
          </h2>
          <p className={styles.kicker}>
            <span>
              {points.length === 1
                ? "1 månad"
                : `${points.length} månader`}
            </span>
            <span>genom året</span>
          </p>
        </div>
        {primaryStats ? (
          <div className={styles.hero}>
            <p
              className={[
                styles.delta,
                primaryStats.count > 1 ? deltaTone : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {primaryStats.count > 1
                ? formatSignedKr(primaryDelta)
                : formatKr(primaryStats.last.value)}
            </p>
            <p className={styles.heroHint}>
              {primaryStats.count > 1
                ? `${seriesMeta(primaryKey).shortLabel} sedan ${monthLabel(primaryStats.first.monthStart)}`
                : `${seriesMeta(primaryKey).shortLabel} · ${monthLabel(primaryStats.last.monthStart)}`}
            </p>
          </div>
        ) : null}
      </header>

      <div className={styles.toggles} role="group" aria-label="Visa konton">
        {FINANCE_CHART_SERIES.map((series) => {
          const on = activeKeys.includes(series.key);
          const hasData = categoryStats.some((row) => row.series.key === series.key);
          if (!hasData && series.key !== "total") return null;
          return (
            <button
              key={series.key}
              type="button"
              className={[styles.toggle, on ? styles.toggleOn : ""]
                .filter(Boolean)
                .join(" ")}
              style={
                {
                  "--series-color": series.color,
                } as CSSProperties
              }
              aria-pressed={on}
              onClick={() => toggleSeries(series.key)}
            >
              <span className={styles.toggleDot} aria-hidden />
              {series.shortLabel}
            </button>
          );
        })}
      </div>

      <div className={styles.chart}>
        <div className={styles.yAxis} aria-hidden>
          {domain.ticks.map((tick) => (
            <span
              key={tick}
              className={styles.yLabel}
              style={{ top: `${plotY(tick)}%` }}
            >
              {formatKrCompact(tick)}
            </span>
          ))}
        </div>

        <div
          className={styles.plot}
          role="group"
          aria-label="Ekonomi genom året"
          tabIndex={0}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            selectAt(event.clientX, rect.width, rect.left);
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "touch") return;
            const rect = event.currentTarget.getBoundingClientRect();
            selectAt(event.clientX, rect.width, rect.left);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "touch") return;
            setActiveMonth(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              setActiveMonth((current) => {
                const base =
                  current ?? (event.key === "ArrowRight" ? -1 : points.length);
                const next =
                  event.key === "ArrowRight" ? base + 1 : base - 1;
                return Math.max(0, Math.min(points.length - 1, next));
              });
            } else if (event.key === "Escape") {
              setActiveMonth(null);
            }
          }}
        >
          <svg
            className={styles.svg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.42" />
                <stop offset="55%" stopColor="#ff7a1a" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            {domain.ticks.map((tick) => (
              <line
                key={tick}
                className={styles.grid}
                x1="0"
                x2="100"
                y1={plotY(tick)}
                y2={plotY(tick)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {seriesPaths.map(({ series, plotted, line, area }) => {
              if (plotted.length === 0) return null;
              const single = visibleSeries.length === 1;
              return (
                <g key={series.key}>
                  {single && area ? (
                    <path className={styles.area} d={area} fill={`url(#${gradId})`} />
                  ) : null}
                  {plotted.length > 1 ? (
                    <path
                      className={styles.line}
                      d={line}
                      stroke={series.color}
                      pathLength={100}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : (
                    <line
                      className={styles.grid}
                      x1="0"
                      x2="100"
                      y1={plotted[0].y}
                      y2={plotted[0].y}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {seriesPaths.flatMap(({ series, plotted }) =>
            plotted.map((point, index) => {
              const isLast = index === plotted.length - 1;
              const isActive =
                activeSnap != null && activeSnap.monthStart === point.monthStart;
              return (
                <span
                  key={`${series.key}-${point.monthStart}`}
                  className={[
                    styles.dot,
                    isLast ? styles.dotLatest : "",
                    isActive ? styles.dotActive : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    borderColor: series.color,
                    background: isLast || isActive ? series.color : "#0a0a0a",
                  }}
                  aria-hidden
                />
              );
            }),
          )}

          {activeSnap ? (
            <>
              <span
                className={styles.guide}
                style={{ left: `${plotX(activeSnap.monthStart)}%` }}
                aria-hidden
              />
              <div
                className={[
                  styles.tip,
                  plotX(activeSnap.monthStart) > 68 ? styles.tipEnd : "",
                  plotX(activeSnap.monthStart) < 28 ? styles.tipStart : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: `${plotX(activeSnap.monthStart)}%`,
                  top: `${Y_TOP + 4}%`,
                }}
              >
                <p className={styles.tipDate}>{monthLabel(activeSnap.monthStart)}</p>
                {visibleSeries.map((series) => {
                  const value = financeSeriesValue(activeSnap, series.key);
                  if (value == null) return null;
                  return (
                    <p key={series.key} className={styles.tipRow}>
                      <span style={{ color: series.color }}>{series.shortLabel}</span>
                      <strong>{formatKr(value)}</strong>
                    </p>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <div className={styles.xAxis} aria-hidden>
          {axisLabels.map((label) => {
            const x = plotX(label.iso);
            const transform =
              x < 10
                ? "translateX(0)"
                : x > 90
                  ? "translateX(-100%)"
                  : "translateX(-50%)";
            return (
              <span
                key={label.iso}
                className={styles.xLabel}
                style={{ left: `${x}%`, transform }}
              >
                {label.text}
              </span>
            );
          })}
        </div>
      </div>

      <ul className={styles.categories}>
        {categoryStats.map(({ series, first, last, delta, count }) => {
          const on = activeKeys.includes(series.key);
          const tone =
            delta > 50
              ? styles.catUp
              : delta < -50
                ? styles.catDown
                : styles.catFlat;
          return (
            <li key={series.key}>
              <button
                type="button"
                className={[styles.category, on ? styles.categoryOn : ""]
                  .filter(Boolean)
                  .join(" ")}
                style={
                  {
                    "--series-color": series.color,
                  } as CSSProperties
                }
                aria-pressed={on}
                onClick={() => toggleSeries(series.key)}
              >
                <span className={styles.catHead}>
                  <span className={styles.catDot} aria-hidden />
                  <span className={styles.catLabel}>{series.label}</span>
                </span>
                <span className={styles.catValue}>{formatKr(last.value)}</span>
                <span className={[styles.catDelta, count > 1 ? tone : ""].filter(Boolean).join(" ")}>
                  {count > 1
                    ? `${formatSignedKr(delta)} sedan ${monthLabel(first.monthStart)}`
                    : `bara ${monthLabel(last.monthStart)}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
