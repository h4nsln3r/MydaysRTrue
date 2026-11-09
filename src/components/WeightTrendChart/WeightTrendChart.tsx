"use client";

import { useId, useState } from "react";
import { diffDaysISO, formatDayLong, formatDayShort } from "@/lib/date";
import { APP_LOCALE, formatWeightKg } from "@/lib/format";
import { WEIGHT_TIME_LABEL, type WeightLog } from "@/lib/weight";
import styles from "./WeightTrendChart.module.scss";

interface Props {
  logs: WeightLog[];
  /** Inclusive period start, YYYY-MM-DD. */
  start: string;
  /** Inclusive period end, YYYY-MM-DD. */
  end: string;
  today: string;
  scope: "year" | "month";
  /** Weigh-in just before the period. Used so a month with one log still has a line. */
  priorLog?: WeightLog | null;
}

const X_INSET = 2.5;
const Y_TOP = 8;
const Y_BOTTOM = 92;

function formatKgTick(kg: number): string {
  return kg.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatSignedKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  const abs = Math.abs(rounded).toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (rounded === 0) return "0,0 kg";
  return `${rounded > 0 ? "+" : "−"}${abs} kg`;
}

function monthName(iso: string): string {
  return formatDayShort(iso).split(" ").slice(1).join(" ");
}

function weightDomain(values: number[]): {
  min: number;
  max: number;
  ticks: number[];
} {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 0.8);
  const rough = span / 3;
  const step = [0.2, 0.5, 1, 2, 5].find((candidate) => candidate + 1e-9 >= rough) ?? 5;
  const floorTo = (n: number) => Math.floor((n + 1e-9) / step) * step;
  const ceilTo = (n: number) => Math.ceil((n - 1e-9) / step) * step;
  let min = floorTo(lo - span * 0.28);
  let max = ceilTo(hi + span * 0.28);
  if (max <= min) max = min + step;
  const count = Math.round((max - min) / step);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    ticks.push(Math.round((min + i * step) * 10) / 10);
  }
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

function yearAxisLabels(axisStart: string, axisEnd: string): { iso: string; text: string }[] {
  const year = axisStart.slice(0, 4);
  const labels: { iso: string; text: string }[] = [];
  for (let month = 1; month <= 12; month += 2) {
    const iso = `${year}-${String(month).padStart(2, "0")}-01`;
    if (iso >= axisStart && iso <= axisEnd) {
      labels.push({ iso, text: monthName(iso) });
    }
  }
  const endMonthStart = `${axisEnd.slice(0, 7)}-01`;
  const last = labels[labels.length - 1];
  if (
    endMonthStart >= axisStart &&
    endMonthStart <= axisEnd &&
    (!last || (last.iso !== endMonthStart && diffDaysISO(last.iso, endMonthStart) >= 20))
  ) {
    labels.push({ iso: endMonthStart, text: monthName(endMonthStart) });
  }
  return labels;
}

function monthAxisLabels(axisStart: string, axisEnd: string): { iso: string; text: string }[] {
  const lastDay = Number(axisEnd.slice(8, 10));
  const days = [1, 8, 15, 22, 29].filter((day) => day <= lastDay);
  const previous = days[days.length - 1] ?? 1;
  if (!days.includes(lastDay) && lastDay - previous >= 3) days.push(lastDay);
  const ym = axisStart.slice(0, 7);
  return days.map((day) => ({
    iso: `${ym}-${String(day).padStart(2, "0")}`,
    text: String(day),
  }));
}

export function WeightTrendChart({ logs, start, end, today, scope, priorLog = null }: Props) {
  const gradId = useId().replace(/:/g, "");
  const titleId = useId();
  const [active, setActive] = useState<number | null>(null);

  const axisEnd = end < today ? end : today;
  const inPeriod = logs
    .filter(
      (log) =>
        log.localDate >= start &&
        log.localDate <= axisEnd &&
        Number.isFinite(log.weightKg) &&
        log.weightKg > 0,
    )
    .slice()
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
  const leadIn =
    scope === "month" &&
    inPeriod.length === 1 &&
    priorLog &&
    priorLog.localDate < start &&
    Number.isFinite(priorLog.weightKg) &&
    priorLog.weightKg > 0
      ? priorLog
      : null;
  const points = leadIn ? [leadIn, ...inPeriod] : inPeriod;
  const axisStart = leadIn ? leadIn.localDate : start;

  const futurePeriod = axisEnd < start;
  const emptyCopy = futurePeriod
    ? null
    : scope === "year"
      ? "Inga vägningar under året ännu."
      : "Inga vägningar den här månaden.";

  if (points.length === 0) {
    if (!emptyCopy) return null;
    return (
      <section className={styles.card} aria-labelledby={titleId}>
        <header className={styles.header}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Vikt
            </h2>
            <p className={styles.kicker}>
              {scope === "year" ? "genom året" : "genom månaden"}
            </p>
          </div>
        </header>
        <p className={styles.empty}>{emptyCopy}</p>
      </section>
    );
  }

  const domain = weightDomain(points.map((log) => log.weightKg));
  const spanDays = diffDaysISO(axisStart, axisEnd);

  const plotX = (iso: string) => {
    if (spanDays <= 0) return 50;
    const t = diffDaysISO(axisStart, iso) / spanDays;
    return X_INSET + Math.min(1, Math.max(0, t)) * (100 - X_INSET * 2);
  };
  const plotY = (kg: number) => {
    const t = (domain.max - kg) / (domain.max - domain.min || 1);
    return Y_TOP + t * (Y_BOTTOM - Y_TOP);
  };

  const plotted = points.map((log) => ({
    log,
    x: plotX(log.localDate),
    y: plotY(log.weightKg),
  }));
  const line = plotted
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const baseY = plotY(domain.min);
  const area = `${line} L${plotted[plotted.length - 1].x.toFixed(2)} ${baseY.toFixed(2)} L${plotted[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`;

  const axisLabels =
    scope === "year"
      ? yearAxisLabels(start, axisEnd)
      : [
          ...(leadIn ? [{ iso: leadIn.localDate, text: formatDayShort(leadIn.localDate) }] : []),
          ...monthAxisLabels(start, axisEnd),
        ];

  const first = points[0];
  const last = points[points.length - 1];
  const minLog = points.reduce((best, log) => (log.weightKg < best.weightKg ? log : best));
  const maxLog = points.reduce((best, log) => (log.weightKg > best.weightKg ? log : best));
  const delta = last.weightKg - first.weightKg;
  const deltaTone = delta < -0.05 ? styles.deltaDown : delta > 0.05 ? styles.deltaUp : styles.deltaFlat;

  const summary = leadIn
    ? `En vägning i månaden, ${formatWeightKg(last.weightKg)} den ${formatDayShort(last.localDate)}, ${formatSignedKg(delta)} sedan ${formatDayShort(first.localDate)}.`
    : points.length === 1
      ? `En vägning: ${formatWeightKg(first.weightKg)} den ${formatDayLong(first.localDate)}.`
      : `${points.length} vägningar från ${formatWeightKg(first.weightKg)} den ${formatDayShort(first.localDate)} till ${formatWeightKg(last.weightKg)} den ${formatDayShort(last.localDate)}.`;

  const activePoint = active != null ? plotted[active] : null;
  const previous = active != null && active > 0 ? points[active - 1] : null;

  const selectAt = (clientX: number, width: number, left: number) => {
    const x = ((clientX - left) / width) * 100;
    let best = 0;
    let bestDist = Infinity;
    plotted.forEach((point, index) => {
      const dist = Math.abs(point.x - x);
      if (dist < bestDist) {
        best = index;
        bestDist = dist;
      }
    });
    setActive(best);
  };

  const moveActive = (key: "ArrowLeft" | "ArrowRight") => {
    setActive((current) => {
      const base = current ?? (key === "ArrowRight" ? -1 : points.length);
      const next = key === "ArrowRight" ? base + 1 : base - 1;
      return Math.max(0, Math.min(points.length - 1, next));
    });
  };

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            Vikt
          </h2>
          <p className={styles.kicker}>
            <span>{inPeriod.length === 1 ? "1 vägning" : `${inPeriod.length} vägningar`}</span>
            <span>{scope === "year" ? "genom året" : "genom månaden"}</span>
          </p>
        </div>
        <div className={styles.hero}>
          <p className={[styles.delta, points.length > 1 ? deltaTone : ""].filter(Boolean).join(" ")}>
            {points.length > 1 ? formatSignedKg(delta) : formatWeightKg(last.weightKg)}
          </p>
          <p className={styles.heroHint}>
            {points.length > 1
              ? `sedan ${formatDayShort(first.localDate)}`
              : formatDayShort(last.localDate)}
          </p>
        </div>
      </header>

      <div className={styles.chart}>
        <div className={styles.yAxis} aria-hidden>
          {domain.ticks.map((tick) => (
            <span key={tick} className={styles.yLabel} style={{ top: `${plotY(tick)}%` }}>
              {formatKgTick(tick)}
            </span>
          ))}
        </div>

        <div
          className={styles.plot}
          role="group"
          aria-label={summary}
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
            setActive(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              moveActive(event.key);
            } else if (event.key === "Escape") {
              setActive(null);
            }
          }}
        >
          <svg className={styles.svg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.5" />
                <stop offset="45%" stopColor="#ff7a1a" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0.06" />
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
            {points.length > 1 ? (
              <>
                <path className={styles.area} d={area} fill={`url(#${gradId})`} />
                <path className={styles.glow} d={line} pathLength={100} vectorEffect="non-scaling-stroke" />
                <path className={styles.line} d={line} pathLength={100} vectorEffect="non-scaling-stroke" />
              </>
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
          </svg>

          {plotted.map((point, index) => {
            const isLast = index === points.length - 1;
            const isActive = index === active;
            return (
              <span
                key={point.log.localDate}
                className={[
                  styles.dot,
                  point.log.localDate < start ? styles.dotPrior : "",
                  isLast ? styles.dotLatest : "",
                  isActive ? styles.dotActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                aria-hidden
              />
            );
          })}

          {activePoint ? (
            <>
              <span className={styles.guide} style={{ left: `${activePoint.x}%` }} aria-hidden />
              <div
                className={[
                  styles.tip,
                  activePoint.y < 28 ? styles.tipBelow : "",
                  activePoint.x > 68 ? styles.tipEnd : "",
                  activePoint.x < 28 ? styles.tipStart : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
              >
                <p className={styles.tipDate}>{formatDayLong(activePoint.log.localDate)}</p>
                <p className={styles.tipValue}>{formatWeightKg(activePoint.log.weightKg)}</p>
                <p className={styles.tipMeta}>
                  {WEIGHT_TIME_LABEL[activePoint.log.timeOfDay]}
                  {previous ? ` · ${formatSignedKg(activePoint.log.weightKg - previous.weightKg)}` : ""}
                </p>
              </div>
            </>
          ) : null}

          <p className={styles.srOnly} aria-live="polite">
            {activePoint
              ? `${formatDayLong(activePoint.log.localDate)}, ${formatWeightKg(activePoint.log.weightKg)}, ${WEIGHT_TIME_LABEL[activePoint.log.timeOfDay]}`
              : ""}
          </p>
        </div>

        <div className={styles.xAxis} aria-hidden>
          {axisLabels.map((label) => {
            const x = plotX(label.iso);
            const transform =
              x < 10 ? "translateX(0)" : x > 90 ? "translateX(-100%)" : "translateX(-50%)";
            return (
              <span key={label.iso} className={styles.xLabel} style={{ left: `${x}%`, transform }}>
                {label.text}
              </span>
            );
          })}
        </div>
      </div>

      {points.length > 1 ? (
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>{first.localDate < start ? "Förra" : "Start"}</dt>
            <dd>{formatWeightKg(first.weightKg)}</dd>
            <p>{formatDayShort(first.localDate)}</p>
          </div>
          <div className={styles.stat}>
            <dt>Senaste</dt>
            <dd>{formatWeightKg(last.weightKg)}</dd>
            <p>{formatDayShort(last.localDate)}</p>
          </div>
          <div className={styles.stat}>
            <dt>Lägst</dt>
            <dd>{formatWeightKg(minLog.weightKg)}</dd>
            <p>{formatDayShort(minLog.localDate)}</p>
          </div>
          <div className={styles.stat}>
            <dt>Högst</dt>
            <dd>{formatWeightKg(maxLog.weightKg)}</dd>
            <p>{formatDayShort(maxLog.localDate)}</p>
          </div>
        </dl>
      ) : (
        <p className={styles.singleHint}>Logga nästa vägning så syns kurvan.</p>
      )}
    </section>
  );
}
