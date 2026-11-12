"use client";

import { useId, useState } from "react";
import { formatDayLong, formatDayShort } from "@/lib/date";
import { APP_LOCALE, formatWeightKg } from "@/lib/format";
import { WEIGHT_TIME_LABEL, type WeightLog } from "@/lib/weight";
import styles from "./month-progress.module.scss";

export interface MonthWeightDay {
  date: string;
  isFuture: boolean;
  isToday: boolean;
}

interface Props {
  days: MonthWeightDay[];
  logs: WeightLog[];
  priorLog: WeightLog | null;
  today: string;
}

const Y_TOP = 18;
const Y_BOTTOM = 82;

function formatSignedKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  const abs = Math.abs(rounded).toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (rounded === 0) return "0,0 kg";
  return `${rounded > 0 ? "+" : "−"}${abs} kg`;
}

function weightDomain(values: number[]): { min: number; max: number } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, 0.6);
  const pad = span * 0.35;
  return { min: lo - pad, max: hi + pad };
}

export function MonthWeightRow({ days, logs, priorLog, today }: Props) {
  const gradId = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const dayCount = days.length;

  const byDate = new Map<string, WeightLog>();
  for (const log of logs) {
    if (log.localDate > today) continue;
    if (!Number.isFinite(log.weightKg) || log.weightKg <= 0) continue;
    byDate.set(log.localDate, log);
  }

  const plotted = days.flatMap((day, index) => {
    const log = byDate.get(day.date);
    if (!log) return [];
    return [
      {
        log,
        index,
        x: ((index + 0.5) / dayCount) * 100,
      },
    ];
  });

  const first = plotted[0]?.log ?? null;
  const last = plotted[plotted.length - 1]?.log ?? null;
  const leadIn =
    plotted.length === 1 &&
    priorLog &&
    priorLog.localDate < (first?.localDate ?? "") &&
    Number.isFinite(priorLog.weightKg) &&
    priorLog.weightKg > 0
      ? priorLog
      : null;
  const compareFrom = leadIn ?? (plotted.length > 1 ? first : null);
  const delta = last && compareFrom ? last.weightKg - compareFrom.weightKg : null;
  const deltaTone =
    delta == null
      ? ""
      : delta < -0.05
        ? styles.weightDeltaDown
        : delta > 0.05
          ? styles.weightDeltaUp
          : styles.weightDeltaFlat;

  const domain =
    plotted.length > 0
      ? weightDomain([
          ...plotted.map((point) => point.log.weightKg),
          ...(leadIn ? [leadIn.weightKg] : []),
        ])
      : null;
  const yOf = (kg: number) => {
    if (!domain) return 50;
    const t = (domain.max - kg) / (domain.max - domain.min || 1);
    return Y_TOP + t * (Y_BOTTOM - Y_TOP);
  };

  const withY = plotted.map((point) => ({ ...point, y: yOf(point.log.weightKg) }));
  const series = leadIn
    ? [{ x: 0, y: yOf(leadIn.weightKg) }, ...withY]
    : withY;
  const line = series
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const area =
    series.length > 1
      ? `${line} L${series[series.length - 1].x.toFixed(2)} ${Y_BOTTOM} L${series[0].x.toFixed(2)} ${Y_BOTTOM} Z`
      : "";

  const activePoint = active != null ? withY[active] : null;
  const previous = active != null && active > 0 ? withY[active - 1] : null;

  const selectAt = (clientX: number, width: number, left: number) => {
    if (withY.length === 0) return;
    const x = ((clientX - left) / width) * 100;
    let best = 0;
    let bestDist = Infinity;
    withY.forEach((point, index) => {
      const dist = Math.abs(point.x - x);
      if (dist < bestDist) {
        best = index;
        bestDist = dist;
      }
    });
    setActive(best);
  };

  const summary =
    last == null
      ? "Inga vägningar den här månaden."
      : withY.length === 1
        ? `En vägning: ${formatWeightKg(last.weightKg)} den ${formatDayLong(last.localDate)}.`
        : `${withY.length} vägningar från ${formatWeightKg(first!.weightKg)} till ${formatWeightKg(last.weightKg)}.`;

  return (
    <tr className={styles.weightRow}>
      <th className={[styles.rowLabel, styles.stickyCol, styles.weightLabel].join(" ")} scope="row">
        <span className={styles.rowIcon} aria-hidden>
          ⚖️
        </span>
        <span className={styles.weightLabelText}>
          <span className={styles.rowText}>Vikt</span>
          {delta != null && compareFrom ? (
            <span className={[styles.weightDelta, deltaTone].filter(Boolean).join(" ")}>
              {formatSignedKg(delta)}
              <span className={styles.weightDeltaSince}>
                sedan {formatDayShort(compareFrom.localDate)}
              </span>
            </span>
          ) : last ? (
            <span className={styles.weightDelta}>{formatWeightKg(last.weightKg)}</span>
          ) : (
            <span className={styles.weightDeltaMuted}>Inga vägningar</span>
          )}
        </span>
      </th>
      <td className={styles.weightPlot} colSpan={dayCount}>
        <div
          className={styles.weightChart}
          role="group"
          aria-label={summary}
          tabIndex={withY.length > 0 ? 0 : undefined}
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            selectAt(event.clientX, rect.width, rect.left);
          }}
          onPointerMove={(event) => {
            if (event.pointerType === "touch" || withY.length === 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            selectAt(event.clientX, rect.width, rect.left);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "touch") return;
            setActive(null);
          }}
          onKeyDown={(event) => {
            if (withY.length === 0) return;
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              setActive((current) => {
                const base = current ?? (event.key === "ArrowRight" ? -1 : withY.length);
                const next = event.key === "ArrowRight" ? base + 1 : base - 1;
                return Math.max(0, Math.min(withY.length - 1, next));
              });
            } else if (event.key === "Escape") {
              setActive(null);
            }
          }}
        >
          <svg className={styles.weightSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff7a1a" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            {days.map((day, index) => (
              <line
                key={day.date}
                className={day.isToday ? styles.weightGridToday : styles.weightGrid}
                x1={(index / dayCount) * 100}
                x2={(index / dayCount) * 100}
                y1="0"
                y2="100"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {series.length > 1 ? (
              <>
                <path d={area} fill={`url(#${gradId})`} stroke="none" />
                <path className={styles.weightLine} d={line} vectorEffect="non-scaling-stroke" />
              </>
            ) : null}
          </svg>

          {withY.map((point, index) => {
            const isLast = index === withY.length - 1;
            const isActive = index === active;
            return (
              <span
                key={point.log.localDate}
                className={[
                  styles.weightDot,
                  isLast ? styles.weightDotLatest : "",
                  isActive ? styles.weightDotActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                aria-hidden
              />
            );
          })}

          {activePoint ? (
            <div
              className={[
                styles.weightTip,
                activePoint.y < 36 ? styles.weightTipBelow : "",
                activePoint.x > 78 ? styles.weightTipEnd : "",
                activePoint.x < 18 ? styles.weightTipStart : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
            >
              <p className={styles.weightTipDate}>{formatDayLong(activePoint.log.localDate)}</p>
              <p className={styles.weightTipValue}>{formatWeightKg(activePoint.log.weightKg)}</p>
              <p className={styles.weightTipMeta}>
                {WEIGHT_TIME_LABEL[activePoint.log.timeOfDay]}
                {previous
                  ? ` · ${formatSignedKg(activePoint.log.weightKg - previous.log.weightKg)}`
                  : ""}
              </p>
            </div>
          ) : null}
        </div>
      </td>
      <td className={[styles.totalCell, styles.weightTotal, styles.stickyColRight].join(" ")}>
        {last ? (
          <span className={styles.weightTotalValue} title={formatWeightKg(last.weightKg)}>
            {last.weightKg.toLocaleString(APP_LOCALE, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
          </span>
        ) : (
          <span className={styles.emptyMark}>—</span>
        )}
      </td>
    </tr>
  );
}
