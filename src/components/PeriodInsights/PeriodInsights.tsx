import type { PeriodInsightModel } from "@/lib/insights";
import styles from "./PeriodInsights.module.scss";

interface Props {
  model: PeriodInsightModel | null;
}

export function PeriodInsights({ model }: Props) {
  if (!model) return null;

  return (
    <section className={styles.wrap} aria-label={model.title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{model.title}</h2>
        <span className={styles.kicker}>{model.kicker}</span>
      </header>

      {model.lead ? <p className={styles.lead}>{model.lead}</p> : null}
      {model.why ? <p className={styles.why}>{model.why}</p> : null}

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
            <p className={styles.rowsCaption}>{model.rowsCaption}</p>
          ) : null}
          <ol className={styles.rowList}>
            {model.rows.map((row) => (
              <li
                key={row.id}
                className={[
                  styles.row,
                  row.peak || row.trainPeak ? styles.rowPeak : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className={styles.rowLabel}>{row.label}</span>
                <span className={styles.rowValue}>{row.value}</span>
                <span className={styles.rowDetail}>{row.detail}</span>
              </li>
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
