import Link from "next/link";
import {
  LIVE_EVENT_KIND_ICON,
  LIVE_EVENT_KIND_LABEL,
  liveEventDetail,
  liveRatingLabel,
  liveYearGroups,
  type YearLiveEventsContext,
} from "@/lib/live-events";
import styles from "./LiveEventsYearProgress.module.scss";

interface Props {
  yearLive: YearLiveEventsContext;
  planHref: string;
}

export function LiveEventsYearProgress({ yearLive, planHref }: Props) {
  const { attended, planned } = liveYearGroups(yearLive.events);

  if (yearLive.events.length === 0) {
    return (
      <p className={styles.empty}>
        Inga live-upplevelser för {yearLive.year} ännu.{" "}
        <Link href={planHref}>Lägg till i planeringen →</Link>
      </p>
    );
  }

  const renderGroup = (
    label: string,
    items: typeof yearLive.events,
    variant: "" | "itemDone" | "itemPlanned",
  ) => {
    if (items.length === 0) return null;
    return (
      <section className={styles.group}>
        <h3 className={styles.groupLabel}>{label}</h3>
        <ul className={styles.list}>
          {items.map((event) => (
            <li
              key={event.id}
              className={[styles.item, variant ? styles[variant] : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.itemIcon} aria-hidden>
                {LIVE_EVENT_KIND_ICON[event.kind]}
              </span>
              <div className={styles.itemMeta}>
                <p className={styles.itemTitle}>{event.title}</p>
                <p className={styles.itemSub}>
                  {LIVE_EVENT_KIND_LABEL[event.kind]} · {event.eventDate.slice(5)}
                  {event.location ? ` · ${event.location}` : ""}
                  {liveRatingLabel(event.rating)
                    ? ` · ${liveRatingLabel(event.rating)}`
                    : ""}
                </p>
                {event.note ? (
                  <p className={styles.itemNote}>{event.note}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div className={styles.board}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statBig}>{attended.length}</span>
          <span className={styles.statLabel}>Genomförda</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statBig}>{planned.length}</span>
          <span className={styles.statLabel}>Planerade</span>
        </div>
      </div>
      {renderGroup("Genomförda", attended, "itemDone")}
      {renderGroup("Planerade", planned, "itemPlanned")}
    </div>
  );
}
