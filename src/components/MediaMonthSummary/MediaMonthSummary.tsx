import Link from "next/link";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  mediaDayLogDetail,
  mediaRatingLabel,
  type MonthMediaContext,
} from "@/lib/media";
import styles from "./MediaMonthSummary.module.scss";

interface Props {
  monthMedia: MonthMediaContext;
  year: number;
}

export function MediaMonthSummary({ monthMedia, year }: Props) {
  const yearHref = `/year?y=${year}&view=progress`;

  if (monthMedia.entries.length === 0) {
    return (
      <section className={styles.section}>
        <header className={styles.header}>
          <h2 className={styles.title}>Läst &amp; tittat</h2>
          <Link href={yearHref} className={styles.link}>
            Årsöversikt →
          </Link>
        </header>
        <p className={styles.empty}>
          Inget loggat den här månaden ännu.
        </p>
      </section>
    );
  }

  const byItem = new Map<
    string,
    {
      item: (typeof monthMedia.entries)[0]["item"];
      days: typeof monthMedia.entries;
    }
  >();
  for (const entry of monthMedia.entries) {
    const prev = byItem.get(entry.item.id);
    if (prev) prev.days.push(entry);
    else byItem.set(entry.item.id, { item: entry.item, days: [entry] });
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Läst &amp; tittat</h2>
        <Link href={yearHref} className={styles.link}>
          Årsöversikt →
        </Link>
      </header>
      <ul className={styles.list}>
        {[...byItem.values()].map(({ item, days }) => {
          const last = days[days.length - 1]!;
          const lastDetail = mediaDayLogDetail(
            item,
            last.position,
            last.didConsume,
          );
          return (
            <li key={item.id} className={styles.item}>
              <span className={styles.icon} aria-hidden>
                {MEDIA_KIND_ICON[item.kind]}
              </span>
              <div className={styles.meta}>
                <p className={styles.itemTitle}>{item.title}</p>
                <p className={styles.itemSub}>
                  {MEDIA_KIND_LABEL[item.kind]}
                  {item.completed ? " · Klart" : ` · ${lastDetail.split(" · ").slice(1).join(" · ") || "Pågår"}`}
                  {mediaRatingLabel(item.rating)
                    ? ` · ${mediaRatingLabel(item.rating)}`
                    : ""}
                  {` · ${days.length} ${days.length === 1 ? "dag" : "dagar"}`}
                </p>
                {item.note ? (
                  <p className={styles.note}>{item.note}</p>
                ) : null}
                <ul className={styles.dayList}>
                  {days.map((d) => (
                    <li key={d.localDate} className={styles.dayEntry}>
                      <span className={styles.dayDate}>{d.localDate.slice(8, 10)}</span>
                      <span className={styles.dayDetail}>
                        {mediaDayLogDetail(item, d.position, d.didConsume)
                          .split(" · ")
                          .slice(1)
                          .join(" · ") || "Loggat"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
