import Link from "next/link";
import { Card } from "@/components/Card/Card";
import { WaterBottle } from "@/components/WaterBottle/WaterBottle";
import { formatMl, type WaterSummary } from "@/lib/water";
import styles from "./WaterHeroCard.module.scss";

interface Props {
  summary: WaterSummary;
  /** Show a "+" badge in the top-right corner linking to this URL. */
  plusHref?: string;
  /** Accessible label for the + button. */
  plusLabel?: string;
}

export function WaterHeroCard({ summary, plusHref, plusLabel }: Props) {
  const remaining = Math.max(0, summary.goalMl - summary.totalMl);

  return (
    // overflow:visible lets the hover glow + pulse ring escape the card edge
    // without being clipped by Card.module.scss's overflow:hidden.
    <Card accent className={styles.card} style={{ overflow: "visible" }}>
      {plusHref ? (
        <Link
          href={plusHref}
          className={styles.plusBtn}
          aria-label={plusLabel ?? "Open water page"}
          title={plusLabel ?? "Water page"}
        >
          <span className={styles.plusPulse} aria-hidden />
          <span className={styles.plusPulse2} aria-hidden />
          <svg
            className={styles.plusIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      ) : null}

      <WaterBottle
        progress={summary.progress}
        totalMl={summary.totalMl}
        goalMl={summary.goalMl}
      />

      <p className={styles.statusLine}>
        {summary.goalMet ? (
          <>
            <span className={styles.statusDotOk} aria-hidden /> Day goal smashed — keep sipping.
          </>
        ) : (
          <>
            <span className={styles.statusDot} aria-hidden /> {formatMl(remaining)} left to hit
            your goal.
          </>
        )}
      </p>
    </Card>
  );
}
