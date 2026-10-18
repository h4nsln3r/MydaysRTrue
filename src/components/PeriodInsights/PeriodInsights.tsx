import type { InsightRow, PeriodInsightModel } from "@/lib/insights";
import styles from "./PeriodInsights.module.scss";

interface Props {
  model: PeriodInsightModel | null;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("sv-SE");
}

function barPercent(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(8, Math.round((value / max) * 100));
}

function CompareCard({
  row,
  maxSteps,
  maxSessions,
}: {
  row: InsightRow;
  maxSteps: number;
  maxSessions: number;
}) {
  const badge = row.peak ? "Bäst" : row.trainPeak ? "Mest träning" : null;

  return (
    <li
      className={[
        styles.card,
        row.peak ? styles.cardBest : "",
        !row.peak && row.trainPeak ? styles.cardTrain : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className={badge ? styles.badge : styles.badgeEmpty}>
        {badge ?? "\u00a0"}
      </p>
      <p className={styles.cardLabel}>{row.label}</p>
      {row.span ? <p className={styles.cardSpan}>{row.span}</p> : <p className={styles.cardSpan}>&nbsp;</p>}

      <p className={styles.metric}>
        <span className={styles.metricValue}>
          {row.steps > 0 ? formatCount(row.steps) : "0"}
        </span>
        <span className={styles.metricUnit}>steg</span>
      </p>
      <div className={styles.track} aria-hidden="true">
        <span
          className={styles.fill}
          style={{ width: `${barPercent(row.steps, maxSteps)}%` }}
        />
      </div>

      <p className={styles.metric}>
        <span className={styles.metricValue}>{row.sessions}</span>
        <span className={styles.metricUnit}>pass</span>
      </p>
      <div className={styles.track} aria-hidden="true">
        <span
          className={[styles.fill, styles.fillTrain].join(" ")}
          style={{ width: `${barPercent(row.sessions, maxSessions)}%` }}
        />
      </div>

      {row.spendLabel ? <p className={styles.cardSpend}>{row.spendLabel}</p> : null}
      {row.detail ? <p className={styles.cardDetail}>{row.detail}</p> : null}
    </li>
  );
}

export function PeriodInsights({ model }: Props) {
  if (!model) return null;

  const maxSteps = Math.max(0, ...model.rows.map((row) => row.steps));
  const maxSessions = Math.max(0, ...model.rows.map((row) => row.sessions));

  return (
    <section className={styles.wrap} aria-label={model.title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{model.title}</h2>
        <span className={styles.kicker}>{model.kicker}</span>
      </header>

      {model.lead ? <p className={styles.lead}>{model.lead}</p> : null}
      {model.why ? <p className={styles.why}>{model.why}</p> : null}

      {model.best ? (
        <div className={styles.best}>
          <p className={styles.bestKicker}>{model.best.kicker}</p>
          <p className={styles.bestTitle}>{model.best.title}</p>
          {model.best.facts ? <p className={styles.bestFacts}>{model.best.facts}</p> : null}
          {model.best.why ? <p className={styles.bestWhy}>{model.best.why}</p> : null}
        </div>
      ) : null}

      {model.stats.length > 0 ? (
        <dl className={styles.stats}>
          {model.stats.map((stat) => (
            <div key={stat.label} className={styles.stat}>
              <dt className={styles.statLabel}>{stat.label}</dt>
              <dd className={styles.statValue}>{stat.value}</dd>
              {stat.hint ? <dd className={styles.statHint}>{stat.hint}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}

      {model.rows.length > 0 ? (
        <div className={styles.rows}>
          {model.rowsCaption ? (
            <p className={styles.rowsCaption} id="insight-compare-caption">
              {model.rowsCaption}
            </p>
          ) : null}
          <ol
            className={styles.compare}
            aria-labelledby={
              model.rowsCaption ? "insight-compare-caption" : undefined
            }
            tabIndex={0}
          >
            {model.rows.map((row) => (
              <CompareCard
                key={row.id}
                row={row}
                maxSteps={maxSteps}
                maxSessions={maxSessions}
              />
            ))}
          </ol>
        </div>
      ) : null}

      {model.highlights.length > 0 ? (
        <ul className={styles.highlights}>
          {model.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
