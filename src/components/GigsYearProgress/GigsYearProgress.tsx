import Link from "next/link";
import {
  MUSIC_BANDS,
  gigBandCounts,
  gigDetail,
  gigYearGroups,
  type YearGigsContext,
} from "@/lib/gigs";
import styles from "./GigsYearProgress.module.scss";

interface Props {
  yearGigs: YearGigsContext;
  planHref: string;
}

export function GigsYearProgress({ yearGigs, planHref }: Props) {
  const { played, planned } = gigYearGroups(yearGigs.gigs);
  const bandCounts = gigBandCounts(yearGigs.gigs);

  if (yearGigs.gigs.length === 0) {
    return (
      <p className={styles.empty}>
        Inga spelningar för {yearGigs.year} ännu.{" "}
        <Link href={planHref}>Lägg till i planeringen →</Link>
      </p>
    );
  }

  const renderGroup = (
    label: string,
    items: typeof yearGigs.gigs,
    variant: "" | "itemDone" | "itemPlanned",
  ) => {
    if (items.length === 0) return null;
    return (
      <section className={styles.group}>
        <h3 className={styles.groupLabel}>{label}</h3>
        <ul className={styles.list}>
          {items.map((gig) => (
            <li
              key={gig.id}
              className={[styles.item, variant ? styles[variant] : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={styles.itemIcon} aria-hidden>
                🎤
              </span>
              <div className={styles.itemMeta}>
                <p className={styles.itemTitle}>{gig.title}</p>
                <p className={styles.itemSub}>{gigDetail(gig)}</p>
                {gig.note ? (
                  <p className={styles.itemNote}>{gig.note}</p>
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
          <span className={styles.statBig}>{played.length}</span>
          <span className={styles.statLabel}>Spelade</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statBig}>{planned.length}</span>
          <span className={styles.statLabel}>Planerade</span>
        </div>
      </div>
      {played.length > 0 ? (
        <div className={styles.bandStats}>
          {MUSIC_BANDS.map((band) =>
            bandCounts[band] > 0 ? (
              <span key={band} className={styles.bandStat}>
                {band}:{" "}
                <span className={styles.bandStatCount}>{bandCounts[band]}</span>
              </span>
            ) : null,
          )}
        </div>
      ) : null}
      {renderGroup("Spelade", played, "itemDone")}
      {renderGroup("Planerade", planned, "itemPlanned")}
    </div>
  );
}
