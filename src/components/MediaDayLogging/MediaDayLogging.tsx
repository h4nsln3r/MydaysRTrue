"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  clearMediaDailyLogAction,
  createMediaItemAction,
  saveMediaDailyLogAction,
} from "@/app/(app)/media-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MediaItemQuickEdit } from "@/components/MediaItemQuickEdit/MediaItemQuickEdit";
import { MediaItemReview } from "@/components/MediaItemReview/MediaItemReview";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  mediaDayLogDetail,
  mediaPositionLabel,
  mediaProgressLabel,
  mediaProgressPct,
  willCompleteMediaItem,
  type DailyMediaContext,
  type MediaItem,
  type MediaKind,
} from "@/lib/media";
import styles from "./MediaDayLogging.module.scss";

const KINDS: MediaKind[] = ["book", "series", "movie"];

interface Props {
  date: string;
  media: DailyMediaContext;
  yearHref: string;
  /** Auto-save on blur/checkbox (day card) vs explicit save button (plan row). */
  variant: "card" | "plan";
  pending?: boolean;
  onError?: (msg: string | null) => void;
  onPendingChange?: (active: boolean) => void;
  onDone: () => void;
}

export function MediaDayLogging({
  date,
  media,
  yearHref,
  variant,
  pending: parentPending = false,
  onError,
  onPendingChange,
  onDone,
}: Props) {
  const [localPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [reviewHighlight, setReviewHighlight] = useState(false);
  const [pendingReviewItem, setPendingReviewItem] = useState<MediaItem | null>(
    null,
  );
  const [preferSelectId, setPreferSelectId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState(media.items[0]?.id ?? "");
  const [position, setPosition] = useState("");
  const [didConsume, setDidConsume] = useState(false);

  const [newKind, setNewKind] = useState<MediaKind>("book");
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newTotalLength, setNewTotalLength] = useState("");

  const pending = parentPending || localPending;
  const hasLogged = media.loggedToday.length > 0;
  const canLogMore = media.items.length > 0;
  const showForm = canLogMore && !pendingReviewItem && !creatingNew;
  const showCreateForm = creatingNew && !pendingReviewItem;

  useEffect(() => {
    if (!showForm) return;
    const preferred =
      preferSelectId && media.items.some((i) => i.id === preferSelectId)
        ? preferSelectId
        : null;
    setSelectedId((prev) => {
      if (preferred) return preferred;
      if (media.items.some((i) => i.id === prev)) return prev;
      return media.items[0]?.id ?? "";
    });
    if (preferred) setPreferSelectId(null);
    setPosition("");
    setDidConsume(false);
    setReviewHighlight(false);
  }, [media.items, showForm, preferSelectId]);

  // Empty library → open create form by default.
  useEffect(() => {
    if (media.items.length === 0 && !hasLogged && !pendingReviewItem) {
      setCreatingNew(true);
    }
  }, [media.items.length, hasLogged, pendingReviewItem]);

  const selected = media.items.find((i) => i.id === selectedId);

  const parsedPosition =
    selected?.kind === "movie"
      ? didConsume
        ? 1
        : 0
      : position.trim() === ""
        ? 0
        : Number(position);

  const showInlineReview = selected
    ? willCompleteMediaItem(selected, parsedPosition, didConsume)
    : false;

  const reportError = (msg: string | null) => {
    setError(msg);
    onError?.(msg);
  };

  const resetCreateForm = () => {
    setNewTitle("");
    setNewAuthor("");
    setNewTotalLength("");
  };

  const createTitle = () => {
    if (!newTitle.trim()) {
      reportError("Skriv en titel.");
      return;
    }

    reportError(null);
    onPendingChange?.(true);
    startTransition(async () => {
      const res = await createMediaItemAction({
        year: media.year,
        kind: newKind,
        title: newTitle,
        author: newKind === "book" ? newAuthor : undefined,
        totalLength:
          newKind === "movie"
            ? null
            : newTotalLength.trim() === ""
              ? undefined
              : Number(newTotalLength),
      });
      if (!res.ok) {
        reportError(res.error ?? "Kunde inte lägga till.");
        onPendingChange?.(false);
        return;
      }
      if (res.id) setPreferSelectId(res.id);
      resetCreateForm();
      setCreatingNew(false);
      onPendingChange?.(false);
      onDone();
    });
  };

  const save = (
    nextId: string,
    nextPosition: string,
    nextDidConsume: boolean,
  ) => {
    if (!nextId) {
      reportError("Välj en titel.");
      return;
    }

    const item = media.items.find((i) => i.id === nextId);
    if (!item) return;

    const pos =
      item.kind === "movie"
        ? nextDidConsume
          ? 1
          : 0
        : nextPosition.trim() === ""
          ? 0
          : Number(nextPosition);

    if (item.kind !== "movie" && (!Number.isInteger(pos) || pos < 0)) {
      reportError("Ogiltig position.");
      return;
    }

    if (variant === "plan" && item.kind !== "movie" && pos <= 0 && !nextDidConsume) {
      reportError("Ange var du är i boken eller serien.");
      return;
    }

    if (variant === "plan" && item.kind === "movie" && !nextDidConsume) {
      reportError("Bocka i att du såg filmen.");
      return;
    }

    const willComplete = willCompleteMediaItem(item, pos, nextDidConsume);

    reportError(null);
    onPendingChange?.(true);
    startTransition(async () => {
      const res = await saveMediaDailyLogAction({
        localDate: date,
        mediaItemId: nextId,
        position: pos,
        didConsume: nextDidConsume,
      });
      if (!res.ok) {
        reportError(res.error ?? "Kunde inte spara.");
        onPendingChange?.(false);
        return;
      }
      if (res.justCompleted || willComplete) {
        setPendingReviewItem({ ...item, completed: true, bestPosition: pos });
        setReviewHighlight(true);
        onPendingChange?.(false);
        return;
      }
      onPendingChange?.(false);
      onDone();
    });
  };

  const undoLog = (mediaItemId: string) => {
    reportError(null);
    onPendingChange?.(true);
    startTransition(async () => {
      const res = await clearMediaDailyLogAction(date, mediaItemId);
      if (!res.ok) reportError(res.error ?? "Kunde inte ta bort.");
      onPendingChange?.(false);
      onDone();
    });
  };

  const openCreate = () => {
    reportError(null);
    setCreatingNew(true);
  };

  const cancelCreate = () => {
    reportError(null);
    resetCreateForm();
    setCreatingNew(false);
  };

  if (pendingReviewItem) {
    return (
      <div className={styles.section}>
        {hasLogged ? (
          <ul className={styles.loggedList}>
            {media.loggedToday.map(({ log, item }) => (
              <li key={item.id} className={styles.loggedItem}>
                <div className={styles.loggedMeta}>
                  <span className={styles.loggedTitle}>{item.title}</span>
                  <span className={styles.loggedDetail}>
                    {mediaDayLogDetail(item, log.position, log.didConsume)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.completedTitle}>
          Klart: <strong>{pendingReviewItem.title}</strong>
        </p>
        <MediaItemReview
          itemId={pendingReviewItem.id}
          kind={pendingReviewItem.kind}
          note={pendingReviewItem.note}
          rating={pendingReviewItem.rating}
          completedOn={pendingReviewItem.completedOn ?? date}
          highlight={reviewHighlight}
          onDismiss={() => {
            setPendingReviewItem(null);
            setReviewHighlight(false);
            onDone();
          }}
          onSaved={() => {
            setPendingReviewItem(null);
            setReviewHighlight(false);
            onDone();
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.section}>
      {hasLogged ? (
        <ul className={styles.loggedList}>
          {media.loggedToday.map(({ log, item }) => (
            <li key={item.id} className={styles.loggedItem}>
              <div className={styles.loggedMeta}>
                <span className={styles.loggedTitle}>{item.title}</span>
                <span className={styles.loggedDetail}>
                  {mediaDayLogDetail(item, log.position, log.didConsume)}
                </span>
              </div>
              <div className={styles.loggedActions}>
                <MediaItemQuickEdit item={item} />
                <button
                  type="button"
                  className={styles.undoBtn}
                  onClick={() => undoLog(item.id)}
                  disabled={pending}
                >
                  Ångra
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {showCreateForm ? (
        <div className={styles.form}>
          <p className={styles.addMorePrompt}>Ny titel för {media.year}</p>
          <div className={styles.kindRow} role="radiogroup" aria-label="Typ">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={newKind === k}
                className={[
                  styles.kindBtn,
                  newKind === k ? styles.kindBtnActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setNewKind(k)}
                disabled={pending}
              >
                {MEDIA_KIND_ICON[k]} {MEDIA_KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <Input
            label="Titel"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={
              newKind === "book"
                ? "t.ex. Dune"
                : newKind === "series"
                  ? "t.ex. Breaking Bad"
                  : "t.ex. Inception"
            }
            maxLength={120}
            disabled={pending}
          />
          {newKind === "book" ? (
            <Input
              label="Författare (valfritt)"
              value={newAuthor}
              onChange={(e) => setNewAuthor(e.target.value)}
              placeholder="t.ex. Frank Herbert"
              maxLength={120}
              disabled={pending}
            />
          ) : null}
          {newKind !== "movie" ? (
            <Input
              label={newKind === "book" ? "Antal sidor" : "Antal avsnitt"}
              type="number"
              inputMode="numeric"
              value={newTotalLength}
              onChange={(e) => setNewTotalLength(e.target.value)}
              placeholder={newKind === "book" ? "t.ex. 412" : "t.ex. 62"}
              disabled={pending}
            />
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending}
            disabled={pending}
            onClick={createTitle}
          >
            Lägg till titel
          </Button>
          {hasLogged || media.items.length > 0 ? (
            <button
              type="button"
              className={styles.undoBtn}
              onClick={cancelCreate}
              disabled={pending}
            >
              Avbryt
            </button>
          ) : (
            <p className={styles.emptyHint}>
              Eller hantera biblioteket i <Link href={yearHref}>årsvyn</Link>.
            </p>
          )}
        </div>
      ) : null}

      {!showCreateForm && hasLogged && !canLogMore ? (
        <button
          type="button"
          className={styles.extraToggle}
          onClick={openCreate}
          disabled={pending}
        >
          + Ny bok / film / serie
        </button>
      ) : null}

      {showForm ? (
        <div className={styles.form}>
          {hasLogged ? (
            <p className={styles.addMorePrompt}>Logga en till titel idag</p>
          ) : null}
          <label className={styles.fieldLabel}>
            <span>Välj titel</span>
            <div className={styles.selectRow}>
              <select
                className={styles.select}
                value={selectedId}
                onChange={(e) => {
                  setSelectedId(e.target.value);
                  setPosition("");
                  setDidConsume(false);
                  setReviewHighlight(false);
                }}
                disabled={pending}
              >
                {media.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {MEDIA_KIND_ICON[item.kind]} {item.title}
                  </option>
                ))}
              </select>
              {selected ? <MediaItemQuickEdit item={selected} /> : null}
            </div>
          </label>

          <button
            type="button"
            className={styles.newTitleLink}
            onClick={openCreate}
            disabled={pending}
          >
            + Ny bok / film / serie
          </button>

          {selected && selected.kind !== "movie" && selected.totalLength ? (
            <div className={styles.progress}>
              <div className={styles.progressMeta}>
                {mediaProgressLabel(selected) ?? "Inte påbörjad"}
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${mediaProgressPct(selected)}%` }}
                />
              </div>
            </div>
          ) : null}

          {selected?.kind === "movie" ? (
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={didConsume}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDidConsume(checked);
                  if (variant === "card") {
                    save(selectedId, "0", checked);
                  }
                }}
                disabled={pending}
              />
              Såg filmen idag
            </label>
          ) : (
            <>
              <Input
                label={selected ? mediaPositionLabel(selected.kind) : "Position"}
                type="number"
                inputMode="numeric"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                onBlur={
                  variant === "card"
                    ? () => save(selectedId, position, didConsume)
                    : undefined
                }
                placeholder={
                  selected?.kind === "book" ? "t.ex. 142" : "t.ex. 5"
                }
                disabled={pending || !selectedId}
              />
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={didConsume}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDidConsume(checked);
                    if (variant === "card") {
                      save(selectedId, position, checked);
                    }
                  }}
                  disabled={pending || !selectedId}
                />
                {selected?.kind === "book" ? "Läste idag" : "Tittade idag"}
              </label>
            </>
          )}

          {showInlineReview && selected ? (
            <p className={styles.completeHint}>
              Spara sidan/avsnittet för att markera som klart och skriva en
              recension.
            </p>
          ) : null}

          {variant === "plan" ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              loading={pending}
              disabled={pending || !selectedId}
              onClick={() => save(selectedId, position, didConsume)}
            >
              {hasLogged ? "Logga titel" : "Logga"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
