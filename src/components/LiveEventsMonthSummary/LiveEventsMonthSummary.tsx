import Link from "next/link";
import {
  LIVE_EVENT_KIND_ICON,
  LIVE_EVENT_KIND_LABEL,
  liveRatingLabel,
  type MonthLiveEventsContext,
} from "@/lib/live-events";
import styles from "./LiveEventsMonthSummary.module.scss";

interface Props {
  monthLive: MonthLiveEventsContext;
  year: number;
}

export function LiveEventsMonthSummary({ monthLive, year }: Props) {
  const yearHref = `/year?y=${year}&view=progress`;

  if (monthLive.events.length === 0) {
    return (
      <section className={styles.section}>
        <header className={styles.header}>
          <h2 className={styles.title}>Live-upplevelser</h2>
          <Link href={yearHref} className={styles.link}>
            Årsöversikt →
          </Link>
        </header>
        <p className={styles.empty}>Inget planerat den här månaden.</p>
      </section>
    );
  }

  const attended = monthLive.events.filter((e) => e.attendedAt);
  const planned = monthLive.events.filter((e) => !e.attendedAt);

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Live-upplevelser</h2>
        <Link href={yearHref} className={styles.link}>
          Årsöversikt →
        </Link>
      </header>
      {planned.length > 0 ? (
        <>
          <h3 className={styles.groupLabel}>Planerade</h3>
          <ul className={styles.list}>
            {planned.map((event) => (
              <li key={event.id} className={styles.item}>
                <span className={styles.icon} aria-hidden>
                  {LIVE_EVENT_KIND_ICON[event.kind]}
                </span>
                <div className={styles.meta}>
                  <p className={styles.itemTitle}>{event.title}</p>
                  <p className={styles.itemSub}>
                    {LIVE_EVENT_KIND_LABEL[event.kind]} · {event.eventDate}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {attended.length > 0 ? (
        <>
          <h3 className={styles.groupLabel}>Genomförda</h3>
          <ul className={styles.list}>
            {attended.map((event) => (
              <li key={event.id} className={[styles.item, styles.itemDone].join(" ")}>
                <span className={styles.icon} aria-hidden>
                  {LIVE_EVENT_KIND_ICON[event.kind]}
                </span>
                <div className={styles.meta}>
                  <p className={styles.itemTitle}>{event.title}</p>
                  <p className={styles.itemSub}>
                    {LIVE_EVENT_KIND_LABEL[event.kind]} · {event.eventDate}
                    {liveRatingLabel(event.rating)
                      ? ` · ${liveRatingLabel(event.rating)}`
                      : ""}
                  </p>
                  {event.note ? (
                    <p className={styles.note}>{event.note}</p>
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
