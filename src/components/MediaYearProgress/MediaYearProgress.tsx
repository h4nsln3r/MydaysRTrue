"use client";

import { CompletionQuickEdit } from "@/components/CompletionQuickEdit/CompletionQuickEdit";
import { buildMediaCompletions } from "@/lib/completions";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  mediaCreditsLabel,
  mediaProgressLabel,
  mediaProgressPct,
  mediaRatingLabel,
  mediaYearGroups,
  type YearMediaContext,
} from "@/lib/media";
import styles from "./MediaYearProgress.module.scss";

interface Props {
  yearMedia: YearMediaContext;
}

export function MediaYearProgress({ yearMedia }: Props) {
  const { completed, inProgress, notStarted } = mediaYearGroups(
    yearMedia.items,
  );

  if (yearMedia.items.length === 0) {
    return (
      <p className={styles.empty}>Inga titlar för {yearMedia.year} ännu.</p>
    );
  }

  const renderGroup = (
    label: string,
    items: typeof yearMedia.items,
    variant: "" | "itemDone" | "itemProgress",
    editable: boolean,
  ) => {
    if (items.length === 0) return null;
    return (
      <section className={styles.group}>
        <h3 className={styles.groupLabel}>{label}</h3>
        <ul className={styles.list}>
          {items.map((item) => {
            const completion = editable
              ? buildMediaCompletions([item])[0]
              : null;
            return (
              <li
                key={item.id}
                className={[styles.item, variant ? styles[variant] : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className={styles.itemIcon} aria-hidden>
                  {MEDIA_KIND_ICON[item.kind]}
                </span>
                <div className={styles.itemMeta}>
                  <p className={styles.itemTitle}>{item.title}</p>
                  <p className={styles.itemSub}>
                    {MEDIA_KIND_LABEL[item.kind]}
                    {mediaCreditsLabel(item)
                      ? ` · ${mediaCreditsLabel(item)}`
                      : ""}
                    {mediaProgressLabel(item)
                      ? ` · ${mediaProgressLabel(item)}`
                      : ""}
                    {mediaRatingLabel(item.rating)
                      ? ` · ${mediaRatingLabel(item.rating)}`
                      : ""}
                    {item.lastActivityDate
                      ? ` · senast ${item.lastActivityDate}`
                      : ""}
                  </p>
                  {item.note ? (
                    <p className={styles.itemNote}>{item.note}</p>
                  ) : null}
                  {item.kind !== "movie" && item.totalLength ? (
                    <div className={styles.bar} aria-hidden>
                      <div
                        className={styles.barFill}
                        style={{ width: `${mediaProgressPct(item)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                {completion ? <CompletionQuickEdit item={completion} /> : null}
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <div className={styles.board}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statBig}>{completed.length}</span>
          <span className={styles.statLabel}>Klart</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statBig}>{inProgress.length}</span>
          <span className={styles.statLabel}>Pågår</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statBig}>{notStarted.length}</span>
          <span className={styles.statLabel}>Ej påbörjad</span>
        </div>
      </div>

      {renderGroup("Klart", completed, "itemDone", true)}
      {renderGroup("Pågår", inProgress, "itemProgress", false)}
      {renderGroup("Ej påbörjad", notStarted, "", false)}
    </div>
  );
}
