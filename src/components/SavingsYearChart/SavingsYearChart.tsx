"use client";

import { useId, useMemo, useState } from "react";
import { formatDayShort } from "@/lib/date";
import {
  bucketSavingsTransfersByMonth,
  formatKr,
  formatKrCompact,
  SAVINGS_TRANSFER_SERIES,
  type MonthSavingsBucket,
  type SavingsTransferEntry,
  type SavingsTransferTaskKey,
} from "@/lib/monthly-finance";
import styles from "./SavingsYearChart.module.scss";

interface Props {
  transfers: SavingsTransferEntry[];
  year: number;
  today: string;
}

const Y_TOP = 8;
const Y_BOTTOM = 92;
const CHART_LEFT = 4;
const CHART_RIGHT = 96;

function monthLabel(iso: string): string {
  return formatDayShort(iso).split(" ").slice(1).join(" ");
}

function shortMonth(iso: string): string {
  const full = monthLabel(iso);
  return full.slice(0, 3);
}

function moneyDomain(values: number[]): {
  min: number;
  max: number;
  ticks: number[];
} {
  const hi = Math.max(...values, 0);
  const span = Math.max(hi, 1000);
  const rough = span / 3;
  const stepCandidates = [
    500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
  ];
  const step =
    stepCandidates.find((candidate) => candidate + 1e-9 >= rough) ?? 1_000_000;
  const max = Math.ceil((hi + span * 0.12) / step) * step || step;
  const ticks: number[] = [];
  const count = Math.round(max / step);
  for (let i = 0; i <= count; i += 1) ticks.push(i * step);
  return { min: 0, max: ticks[ticks.length - 1], ticks };
}

function monthsInScope(year: number, today: string): string[] {
  const currentYm = today.slice(0, 7);
  const out: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    if (ym > currentYm) break;
    out.push(`${ym}-01`);
  }
  return out;
}

export function SavingsYearChart({ transfers, year, today }: Props) {
  const titleId = useId();
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<SavingsTransferTaskKey>>(
    () => new Set(),
  );

  const buckets = useMemo(
    () => bucketSavingsTransfersByMonth(transfers),
    [transfers],
  );
  const byMonth = useMemo(() => {
    const map = new Map<string, MonthSavingsBucket>();
    for (const bucket of buckets) map.set(bucket.monthStart, bucket);
    return map;
  }, [buckets]);

  const months = monthsInScope(year, today);
  const visibleSeries = SAVINGS_TRANSFER_SERIES.filter(
    (series) => !hidden.has(series.key),
  );

  const monthTotals = months.map((monthStart) => {
    const bucket = byMonth.get(monthStart);
    if (!bucket) return 0;
    return visibleSeries.reduce(
      (sum, series) => sum + (bucket.byKey[series.key] ?? 0),
      0,
    );
  });
  const yearTotal = buckets.reduce((sum, bucket) => sum + bucket.totalKr, 0);
  const monthsWithSaving = buckets.length;

  if (months.length === 0) return null;

  if (buckets.length === 0) {
    return (
      <section className={styles.card} aria-labelledby={titleId}>
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Sparande
            </h2>
            <p className={styles.kicker}>överföringar per månad</p>
          </div>
        </header>
        <p className={styles.empty}>
          Inga överföringar registrerade under året ännu. När du loggar sparande
          till ISK, Avanza eller SBAB syns det här.
        </p>
      </section>
    );
  }

  const domain = moneyDomain(monthTotals);
  const plotY = (kr: number) => {
    const t = (domain.max - kr) / (domain.max - domain.min || 1);
    return Y_TOP + t * (Y_BOTTOM - Y_TOP);
  };
  const plotHeight = (kr: number) => {
    const top = plotY(kr);
    return Math.max(0, Y_BOTTOM - top);
  };

  const slotWidth =
    months.length > 0
      ? (CHART_RIGHT - CHART_LEFT) / months.length
      : CHART_RIGHT - CHART_LEFT;
  const barWidth = Math.min(5.2, slotWidth * 0.62);

  const toggleSeries = (key: SavingsTransferTaskKey) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else {
        if (next.size >= SAVINGS_TRANSFER_SERIES.length - 1) return current;
        next.add(key);
      }
      return next;
    });
  };

  const activeBucket = activeMonth ? byMonth.get(activeMonth) : null;
  const avg =
    monthsWithSaving > 0 ? Math.round(yearTotal / monthsWithSaving) : 0;

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            Sparande
          </h2>
          <p className={styles.kicker}>
            <span>
              {monthsWithSaving === 1
                ? "1 månad"
                : `${monthsWithSaving} månader`}
            </span>
            <span>överföringar</span>
          </p>
        </div>
        <div className={styles.hero}>
          <p className={styles.delta}>{formatKr(yearTotal)}</p>
          <p className={styles.heroHint}>
            totalt · snitt {formatKr(avg)} / månad
          </p>
        </div>
      </header>

      <div className={styles.toggles} role="group" aria-label="Visa konton">
        {SAVINGS_TRANSFER_SERIES.map((series) => {
          const on = !hidden.has(series.key);
          return (
            <button
              key={series.key}
              type="button"
              className={[styles.toggle, on ? styles.toggleOn : ""]
                .filter(Boolean)
                .join(" ")}
              style={{ ["--series-color" as string]: series.color }}
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
          role="img"
          aria-label="Sparöverföringar per månad"
          onPointerLeave={() => setActiveMonth(null)}
        >
          <svg
            className={styles.svg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
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

            {months.map((monthStart, index) => {
              const bucket = byMonth.get(monthStart);
              const cx = CHART_LEFT + slotWidth * (index + 0.5);
              const x = cx - barWidth / 2;
              let stacked = 0;
              const segments = visibleSeries
                .map((series) => {
                  const value = bucket?.byKey[series.key] ?? 0;
                  if (value <= 0) return null;
                  const y = plotY(stacked + value);
                  const height = plotHeight(value);
                  const seg = {
                    key: series.key,
                    color: series.color,
                    x,
                    y,
                    width: barWidth,
                    height,
                    value,
                  };
                  stacked += value;
                  return seg;
                })
                .filter((seg): seg is NonNullable<typeof seg> => seg != null);

              const isActive = activeMonth === monthStart;

              return (
                <g
                  key={monthStart}
                  className={styles.barGroup}
                  onPointerEnter={() => setActiveMonth(monthStart)}
                  onFocus={() => setActiveMonth(monthStart)}
                >
                  {/* Hit area */}
                  <rect
                    x={CHART_LEFT + slotWidth * index}
                    y={Y_TOP}
                    width={slotWidth}
                    height={Y_BOTTOM - Y_TOP}
                    fill="transparent"
                  />
                  {segments.map((seg) => (
                    <rect
                      key={seg.key}
                      className={[
                        styles.bar,
                        isActive ? styles.barActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      x={seg.x}
                      y={seg.y}
                      width={seg.width}
                      height={Math.max(seg.height, 0.4)}
                      fill={seg.color}
                      rx={0.4}
                    />
                  ))}
                </g>
              );
            })}
          </svg>

          {activeBucket ? (
            <div
              className={[
                styles.tip,
                months.indexOf(activeBucket.monthStart) >
                months.length * 0.65
                  ? styles.tipEnd
                  : "",
                months.indexOf(activeBucket.monthStart) < months.length * 0.2
                  ? styles.tipStart
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                left: `${
                  CHART_LEFT +
                  slotWidth * (months.indexOf(activeBucket.monthStart) + 0.5)
                }%`,
                top: `${Y_TOP + 2}%`,
              }}
            >
              <p className={styles.tipDate}>
                {monthLabel(activeBucket.monthStart)}
              </p>
              {SAVINGS_TRANSFER_SERIES.map((series) => {
                const value = activeBucket.byKey[series.key];
                if (value <= 0) return null;
                return (
                  <p key={series.key} className={styles.tipRow}>
                    <span style={{ color: series.color }}>
                      {series.shortLabel}
                    </span>
                    <strong>{formatKr(value)}</strong>
                  </p>
                );
              })}
              <p className={styles.tipTotal}>
                <span>Totalt</span>
                <strong>{formatKr(activeBucket.totalKr)}</strong>
              </p>
            </div>
          ) : null}
        </div>

        <div className={styles.xAxis} aria-hidden>
          {months.map((monthStart, index) => {
            if (months.length > 8 && index % 2 === 1) return null;
            const x = CHART_LEFT + slotWidth * (index + 0.5);
            return (
              <span
                key={monthStart}
                className={styles.xLabel}
                style={{ left: `${x}%`, transform: "translateX(-50%)" }}
              >
                {shortMonth(monthStart)}
              </span>
            );
          })}
        </div>
      </div>

      <ul className={styles.categories}>
        {SAVINGS_TRANSFER_SERIES.map((series) => {
          const total = buckets.reduce(
            (sum, bucket) => sum + bucket.byKey[series.key],
            0,
          );
          const on = !hidden.has(series.key);
          return (
            <li key={series.key}>
              <button
                type="button"
                className={[styles.category, on ? styles.categoryOn : ""]
                  .filter(Boolean)
                  .join(" ")}
                style={{ ["--series-color" as string]: series.color }}
                aria-pressed={on}
                onClick={() => toggleSeries(series.key)}
              >
                <span className={styles.catHead}>
                  <span className={styles.catDot} aria-hidden />
                  <span className={styles.catLabel}>{series.label}</span>
                </span>
                <span className={styles.catValue}>
                  {total > 0 ? formatKr(total) : "—"}
                </span>
                <span className={styles.catDelta}>sparat i år</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
