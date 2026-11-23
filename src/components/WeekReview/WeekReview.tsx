import Link from "next/link";
import { dayPageHref } from "@/components/DayNav/DayNav";
import { todayLocalISO } from "@/lib/date";
import type { WeekReviewModel } from "@/lib/week-review";
import styles from "./WeekReview.module.scss";

interface Props {
  model: WeekReviewModel | null;
  /** Defaults to today in Europe/Stockholm. */
  today?: string;
}

function severityLabel(severity: "empty" | "thin"): string {
  if (severity === "empty") return "Nästan tom";
  return "Luckor";
}

export function WeekReview({ model, today = todayLocalISO() }: Props) {
  if (!model) return null;

  return (
    <section className={styles.wrap} aria-label={model.title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{model.title}</h2>
        <span className={styles.kicker}>{model.kicker}</span>
      </header>

      {model.lead ? <p className={styles.lead}>{model.lead}</p> : null}

      {model.gapDays.length > 0 ? (
        <div className={styles.block}>
          <p className={styles.blockTitle} id="week-review-gaps">
            Dagar att fylla i
          </p>
          <ul className={styles.gapList} aria-labelledby="week-review-gaps">
            {model.gapDays.map((day) => (
              <li key={day.date}>
                <Link
                  href={dayPageHref(day.date, today, "progress")}
                  className={[
                    styles.gapLink,
                    day.severity === "empty" && styles.gapEmpty,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className={styles.gapTop}>
                    <span className={styles.gapLabel}>{day.label}</span>
                    <span className={styles.gapBadge}>
                      {severityLabel(day.severity)}
                    </span>
                  </span>
                  {day.missing.length > 0 ? (
                    <span className={styles.gapMeta}>
                      Saknas: {day.missing.join(" · ")}
                    </span>
                  ) : null}
                  {day.openPlan.length > 0 ? (
                    <span className={styles.gapPlan}>
                      Ej markerat: {day.openPlan.join(" · ")}
                    </span>
                  ) : null}
                  <span className={styles.gapFill} aria-hidden="true">
                    {day.fillPct}% ifyllt
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {model.slips.length > 0 ? (
        <div className={styles.block}>
          <p className={styles.blockTitle}>Halkade efter</p>
          <ul className={styles.slipList}>
            {model.slips.map((slip) => (
              <li key={slip.id} className={styles.slip}>
                <span className={styles.slipLabel}>{slip.label}</span>
                <span className={styles.slipDetail}>{slip.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {model.tips.length > 0 ? (
        <div className={styles.block}>
          <p className={styles.blockTitle}>Nästa vecka</p>
          <ul className={styles.tipList}>
            {model.tips.map((tip) => (
              <li key={tip.id} className={styles.tip}>
                {tip.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
