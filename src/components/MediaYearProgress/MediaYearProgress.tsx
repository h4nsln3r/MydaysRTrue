"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { archiveMediaItemAction } from "@/app/(app)/media-actions";
import { Button } from "@/components/Button/Button";
import { CompletionQuickEdit } from "@/components/CompletionQuickEdit/CompletionQuickEdit";
import { MediaItemQuickEdit } from "@/components/MediaItemQuickEdit/MediaItemQuickEdit";
import { MediaItemReview } from "@/components/MediaItemReview/MediaItemReview";
import { buildMediaCompletions } from "@/lib/completions";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  isMediaAtEnd,
  mediaCreditsLabel,
  mediaDisplayTitle,
  mediaProgressLabel,
  mediaProgressPct,
  mediaRatingLabel,
  mediaYearGroups,
  type MediaItem,
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
    mode: "completed" | "open",
    canRemove = false,
  ) => {
    if (items.length === 0) return null;
    return (
      <section className={styles.group}>
        <h3 className={styles.groupLabel}>{label}</h3>
        <ul className={styles.list}>
          {items.map((item) => {
            const completion =
              mode === "completed" ? buildMediaCompletions([item])[0] : null;
            const showReview =
              (item.kind === "series" || item.kind === "movie") &&
              (item.completed || isMediaAtEnd(item));
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
                  <p className={styles.itemTitle}>{mediaDisplayTitle(item)}</p>
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
                {completion && item.kind === "book" ? (
                  <CompletionQuickEdit item={completion} />
                ) : null}
                {mode === "open" ? <MediaItemQuickEdit item={item} /> : null}
                {canRemove ? <MediaItemRemoveButton item={item} /> : null}
                {showReview ? <MediaFinishReview item={item} /> : null}
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

      {renderGroup("Klart", completed, "itemDone", "completed")}
      {renderGroup("Pågår", inProgress, "itemProgress", "open")}
      {renderGroup("Ej påbörjad", notStarted, "", "open", true)}
    </div>
  );
}

function MediaFinishReview({ item }: { item: MediaItem }) {
  const needsRating = item.rating == null;
  const [open, setOpen] = useState(needsRating);

  if (!open) {
    return (
      <button
        type="button"
        className={styles.reviewToggle}
        onClick={() => setOpen(true)}
      >
        Betyg och kommentar
      </button>
    );
  }

  return (
    <div className={styles.review}>
      <MediaItemReview
        itemId={item.id}
        kind={item.kind}
        note={item.note}
        rating={item.rating}
        completedOn={item.completedOn ?? item.lastActivityDate}
        highlight={needsRating}
        compact
        requireRating
        prompt={
          needsRating
            ? "Inget betyg än, så den är inte klar. Ge betyg och kommentar när du sett klart."
            : "Ändra betyg och kommentar."
        }
      />
    </div>
  );
}

function MediaItemRemoveButton({ item }: { item: MediaItem }) {
  const [open, setOpen] = useState(false);
  const title = mediaDisplayTitle(item);

  return (
    <>
      <button
        type="button"
        className={styles.removeBtn}
        onClick={() => setOpen(true)}
        aria-label={`Ta bort ${title}`}
      >
        Ta bort
      </button>
      {open ? (
        <RemoveMediaModal item={item} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function RemoveMediaModal({
  item,
  onClose,
}: {
  item: MediaItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const title = mediaDisplayTitle(item);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close, pending]);

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const res = await archiveMediaItemAction(item.id);
      if (!res.ok) {
        setError(res.error ?? "Kunde inte ta bort.");
        return;
      }
      router.refresh();
      close();
    });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.backdrop} onClick={pending ? undefined : close}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <p className={styles.kicker}>
              {MEDIA_KIND_ICON[item.kind]} {MEDIA_KIND_LABEL[item.kind]}
            </p>
            <h2 id={titleId} className={styles.title}>
              Ta bort?
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            disabled={pending}
            aria-label="Stäng"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>
          <p className={styles.confirmText}>
            Är du säker på att du vill ta bort {title}? Den försvinner från
            årets lista.
          </p>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <Button
              type="button"
              variant="ghost"
              size="md"
              disabled={pending}
              onClick={close}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              loading={pending}
              disabled={pending}
              onClick={remove}
            >
              Ta bort
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
