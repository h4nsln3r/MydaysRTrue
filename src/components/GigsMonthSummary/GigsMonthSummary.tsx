import Link from "next/link";
import {
  gigDetail,
  gigRatingLabel,
  type MonthGigsContext,
} from "@/lib/gigs";
import styles from "./GigsMonthSummary.module.scss";

interface Props {
  monthGigs: MonthGigsContext;
  year: number;
}

export function GigsMonthSummary({ monthGigs, year }: Props) {
  const yearHref = `/year?y=${year}&view=progress`;

  if (monthGigs.gigs.length === 0) {
    return (
      <section className={styles.section}>
        <header className={styles.header}>
          <h2 className={styles.title}>Spelningar</h2>
          <Link href={yearHref} className={styles.link}>
            Årsöversikt →
          </Link>
        </header>
        <p className={styles.empty}>Inga spelningar den här månaden.</p>
      </section>
    );
  }

  const played = monthGigs.gigs.filter((g) => g.playedAt);
  const planned = monthGigs.gigs.filter((g) => !g.playedAt);

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Spelningar</h2>
        <Link href={yearHref} className={styles.link}>
          Årsöversikt →
        </Link>
      </header>
      {planned.length > 0 ? (
        <>
          <h3 className={styles.groupLabel}>Planerade</h3>
          <ul className={styles.list}>
            {planned.map((gig) => (
              <li key={gig.id} className={styles.item}>
                <span className={styles.icon} aria-hidden>
                  🎤
                </span>
                <div className={styles.meta}>
                  <p className={styles.itemTitle}>{gig.title}</p>
                  <p className={styles.itemSub}>
                    {gig.band} · {gig.eventDate}
                    {gig.venue ? ` · ${gig.venue}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {played.length > 0 ? (
        <>
          <h3 className={styles.groupLabel}>Spelade</h3>
          <ul className={styles.list}>
            {played.map((gig) => (
              <li key={gig.id} className={[styles.item, styles.itemDone].join(" ")}>
                <span className={styles.icon} aria-hidden>
                  🎤
                </span>
                <div className={styles.meta}>
                  <p className={styles.itemTitle}>{gig.title}</p>
                  <p className={styles.itemSub}>
                    {gigDetail(gig)}
                    {gigRatingLabel(gig.rating)
                      ? ` · ${gigRatingLabel(gig.rating)}`
                      : ""}
                  </p>
                  {gig.note ? (
                    <p className={styles.note}>{gig.note}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
