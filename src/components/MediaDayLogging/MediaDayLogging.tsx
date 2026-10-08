"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  clearMediaDailyLogAction,
  clearMediaOtherLogAction,
  createMediaItemAction,
  saveMediaDailyLogAction,
  saveMediaOtherLogAction,
} from "@/app/(app)/media-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { MediaItemQuickEdit } from "@/components/MediaItemQuickEdit/MediaItemQuickEdit";
import { MediaItemReview } from "@/components/MediaItemReview/MediaItemReview";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  MEDIA_OTHER_KIND_ICON,
  MEDIA_OTHER_KIND_LABEL,
  MEDIA_OTHER_KINDS,
  MEDIA_OTHER_SELECT_ID,
  mediaDayLogDetail,
  mediaDisplayTitle,
  mediaOtherLogDetail,
  isMediaAtEnd,
  isMediaFinaleLog,
  mediaPositionLabel,
  mediaProgressLabel,
  mediaProgressPct,
  nextMediaSeason,
  willCompleteMediaItem,
  type DailyMediaContext,
  type MediaItem,
  type MediaKind,
  type MediaOtherKind,
} from "@/lib/media";
import styles from "./MediaDayLogging.module.scss";

const KINDS: MediaKind[] = ["book", "series", "movie"];

/** Prefill the last episode when that season is watched but not rated yet. */
function finalePosition(item: MediaItem | undefined): string {
  if (
    item?.kind === "series" &&
    item.rating == null &&
    item.totalLength != null &&
    item.bestPosition === item.totalLength
  ) {
    return String(item.totalLength);
  }
  return "";
}

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

  const [selectedId, setSelectedId] = useState(
    media.items[0]?.id ?? MEDIA_OTHER_SELECT_ID,
  );
  const [position, setPosition] = useState("");
  const [didConsume, setDidConsume] = useState(false);
  const [otherKind, setOtherKind] = useState<MediaOtherKind>("book");
  const [otherLabel, setOtherLabel] = useState("");
  const [otherNote, setOtherNote] = useState("");

  const [newKind, setNewKind] = useState<MediaKind>("book");
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newSeason, setNewSeason] = useState("1");
  const [newTotalLength, setNewTotalLength] = useState("");
  const [offerNextSeason, setOfferNextSeason] = useState(false);
  const [nextSeason, setNextSeason] = useState("");
  const [nextEpisodes, setNextEpisodes] = useState("");

  const pending = parentPending || localPending;
  const hasLogged =
    media.loggedToday.length > 0 || media.otherLogs.length > 0;
  const canLogMore = media.items.length > 0;
  const loggingOther =
    !canLogMore || selectedId === MEDIA_OTHER_SELECT_ID;
  const showForm = !pendingReviewItem && !creatingNew;
  const showCreateForm = creatingNew && !pendingReviewItem;

  useEffect(() => {
    if (!showForm) return;
    const preferred =
      preferSelectId && media.items.some((i) => i.id === preferSelectId)
        ? preferSelectId
        : null;
    const keepCurrent =
      selectedId === MEDIA_OTHER_SELECT_ID ||
      media.items.some((i) => i.id === selectedId);
    const nextId = preferred
      ? preferred
      : keepCurrent
        ? selectedId
        : (media.items[0]?.id ?? MEDIA_OTHER_SELECT_ID);
    setSelectedId(nextId);
    if (preferred) setPreferSelectId(null);
    if (nextId === MEDIA_OTHER_SELECT_ID) {
      setPosition("");
      setDidConsume(false);
      setReviewHighlight(false);
      return;
    }
    setPosition(finalePosition(media.items.find((i) => i.id === nextId)));
    setDidConsume(false);
    setReviewHighlight(false);
  }, [media.items, showForm, preferSelectId, selectedId]);

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
  const awaitingFinishChoice = selected
    ? isMediaFinaleLog(selected, parsedPosition, didConsume)
    : false;

  const openLoggedReview = (item: MediaItem, loggedPosition: number) => {
    setPendingReviewItem({
      ...item,
      bestPosition: Math.max(item.bestPosition, loggedPosition),
    });
    setReviewHighlight(true);
    setOfferNextSeason(false);
  };

  const reportError = (msg: string | null) => {
    setError(msg);
    onError?.(msg);
  };

  const resetCreateForm = () => {
    setNewTitle("");
    setNewAuthor("");
    setNewSeason("1");
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
        season: newKind === "series" ? Number(newSeason) : null,
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
    finish = false,
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
    const openingReview =
      finish &&
      isMediaFinaleLog(item, pos, nextDidConsume) &&
      (item.kind === "series" || item.kind === "movie");

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
      if (openingReview || res.justCompleted || willComplete) {
        setPendingReviewItem({
          ...item,
          completed: item.kind === "book",
          bestPosition: Math.max(item.bestPosition, pos),
        });
        setReviewHighlight(true);
        setOfferNextSeason(false);
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

  const saveOther = () => {
    const note = otherNote.trim();
    if (!note) {
      reportError("Skriv vad du läste eller tittade på.");
      return;
    }
    if (otherKind === "other" && !otherLabel.trim()) {
      reportError("Skriv vad det är.");
      return;
    }

    reportError(null);
    onPendingChange?.(true);
    startTransition(async () => {
      const res = await saveMediaOtherLogAction({
        localDate: date,
        kind: otherKind,
        otherLabel: otherKind === "other" ? otherLabel : undefined,
        note,
      });
      if (!res.ok) {
        reportError(res.error ?? "Kunde inte spara.");
        onPendingChange?.(false);
        return;
      }
      setOtherNote("");
      setOtherLabel("");
      onPendingChange?.(false);
      onDone();
    });
  };

  const undoOther = (id: string) => {
    reportError(null);
    onPendingChange?.(true);
    startTransition(async () => {
      const res = await clearMediaOtherLogAction(id);
      if (!res.ok) reportError(res.error ?? "Kunde inte ta bort.");
      onPendingChange?.(false);
      onDone();
    });
  };

  const openOther = () => {
    reportError(null);
    resetCreateForm();
    setCreatingNew(false);
    setSelectedId(MEDIA_OTHER_SELECT_ID);
  };

  const finishReview = () => {
    if (pendingReviewItem?.kind === "series") {
      setNextSeason(String(nextMediaSeason(pendingReviewItem.season)));
      setNextEpisodes("");
      setOfferNextSeason(true);
      setReviewHighlight(false);
      return;
    }
    setPendingReviewItem(null);
    setReviewHighlight(false);
    setOfferNextSeason(false);
    onDone();
  };

  const skipNextSeason = () => {
    setPendingReviewItem(null);
    setOfferNextSeason(false);
    setReviewHighlight(false);
    onDone();
  };

  const startNextSeason = () => {
    if (!pendingReviewItem) return;
    if (!nextSeason.trim() || !Number.isInteger(Number(nextSeason))) {
      reportError("Ange vilken säsong du tittar på.");
      return;
    }
    if (!nextEpisodes.trim() || !Number.isInteger(Number(nextEpisodes))) {
      reportError("Ange antal avsnitt i säsongen.");
      return;
    }

    reportError(null);
    onPendingChange?.(true);
    startTransition(async () => {
      const res = await createMediaItemAction({
        year: media.year,
        kind: "series",
        title: pendingReviewItem.title,
        season: Number(nextSeason),
        totalLength: Number(nextEpisodes),
      });
      if (!res.ok) {
        reportError(res.error ?? "Kunde inte lägga till säsongen.");
        onPendingChange?.(false);
        return;
      }
      if (res.id) setPreferSelectId(res.id);
      setPendingReviewItem(null);
      setOfferNextSeason(false);
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

  const renderOtherLogs = (allowUndo: boolean) =>
    media.otherLogs.map((log) => (
      <li key={log.id} className={styles.loggedItem}>
        <div className={styles.loggedMeta}>
          <span className={styles.loggedTitle}>{mediaOtherLogDetail(log)}</span>
        </div>
        {allowUndo ? (
          <button
            type="button"
            className={styles.undoBtn}
            onClick={() => undoOther(log.id)}
            disabled={pending}
          >
            Ångra
          </button>
        ) : null}
      </li>
    ));

  if (pendingReviewItem && offerNextSeason) {
    return (
      <div className={styles.section}>
        {hasLogged ? (
          <ul className={styles.loggedList}>
            {media.loggedToday.map(({ log, item }) => (
              <li key={item.id} className={styles.loggedItem}>
                <div className={styles.loggedMeta}>
                  <span className={styles.loggedTitle}>
                    {mediaDisplayTitle(item)}
                  </span>
                  <span className={styles.loggedDetail}>
                    {mediaDayLogDetail(item, log.position, log.didConsume)}
                  </span>
                </div>
              </li>
            ))}
            {renderOtherLogs(false)}
          </ul>
        ) : null}
        <p className={styles.completedTitle}>
          <strong>{mediaDisplayTitle(pendingReviewItem)}</strong> är klar.
        </p>
        <div className={styles.form}>
          <p className={styles.addMorePrompt}>Starta nästa säsong?</p>
          <div className={styles.fieldRow}>
            <Input
              label="Säsong"
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={nextSeason}
              onChange={(e) => setNextSeason(e.target.value)}
              disabled={pending}
            />
            <Input
              label="Avsnitt i säsongen"
              type="number"
              inputMode="numeric"
              value={nextEpisodes}
              onChange={(e) => setNextEpisodes(e.target.value)}
              placeholder="t.ex. 10"
              disabled={pending}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            loading={pending}
            disabled={pending}
            onClick={startNextSeason}
          >
            Starta säsong {nextSeason || nextMediaSeason(pendingReviewItem.season)}
          </Button>
          <button
            type="button"
            className={styles.undoBtn}
            onClick={skipNextSeason}
            disabled={pending}
          >
            Inte nu
          </button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    );
  }

  if (pendingReviewItem) {
    return (
      <div className={styles.section}>
        {hasLogged ? (
          <ul className={styles.loggedList}>
            {media.loggedToday.map(({ log, item }) => (
              <li key={item.id} className={styles.loggedItem}>
                <div className={styles.loggedMeta}>
                  <span className={styles.loggedTitle}>
                    {mediaDisplayTitle(item)}
                  </span>
                  <span className={styles.loggedDetail}>
                    {mediaDayLogDetail(item, log.position, log.didConsume)}
                  </span>
                </div>
              </li>
            ))}
            {renderOtherLogs(false)}
          </ul>
        ) : null}
        <p className={styles.completedTitle}>
          Klart: <strong>{mediaDisplayTitle(pendingReviewItem)}</strong>
        </p>
        <MediaItemReview
          itemId={pendingReviewItem.id}
          kind={pendingReviewItem.kind}
          note={pendingReviewItem.note}
          rating={pendingReviewItem.rating}
          completedOn={pendingReviewItem.completedOn ?? date}
          highlight={reviewHighlight}
          requireRating={pendingReviewItem.kind !== "book"}
          onDismiss={() => {
            setPendingReviewItem(null);
            setReviewHighlight(false);
            onDone();
          }}
          onSaved={finishReview}
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
                <span className={styles.loggedTitle}>
                  {mediaDisplayTitle(item)}
                </span>
                <span className={styles.loggedDetail}>
                  {mediaDayLogDetail(item, log.position, log.didConsume)}
                </span>
              </div>
              <div className={styles.loggedActions}>
                <MediaItemQuickEdit item={item} />
                {(item.kind === "series" || item.kind === "movie") &&
                item.rating == null &&
                isMediaAtEnd({
                  ...item,
                  bestPosition: Math.max(item.bestPosition, log.position),
                }) ? (
                  <button
                    type="button"
                    className={styles.undoBtn}
                    onClick={() => openLoggedReview(item, log.position)}
                    disabled={pending}
                  >
                    Ge betyg
                  </button>
                ) : null}
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
          {renderOtherLogs(true)}
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
                onClick={() => {
                  setNewKind(k);
                  if (k === "series" && !newSeason.trim()) setNewSeason("1");
                }}
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
          {newKind === "series" ? (
            <div className={styles.fieldRow}>
              <Input
                label="Säsong"
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={newSeason}
                onChange={(e) => setNewSeason(e.target.value)}
                placeholder="t.ex. 1"
                disabled={pending}
              />
              <Input
                label="Avsnitt i säsongen"
                type="number"
                inputMode="numeric"
                value={newTotalLength}
                onChange={(e) => setNewTotalLength(e.target.value)}
                placeholder="t.ex. 10"
                disabled={pending}
              />
            </div>
          ) : null}
          {newKind === "book" ? (
            <Input
              label="Antal sidor"
              type="number"
              inputMode="numeric"
              value={newTotalLength}
              onChange={(e) => setNewTotalLength(e.target.value)}
              placeholder="t.ex. 412"
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
          <button
            type="button"
            className={styles.newTitleLink}
            onClick={openOther}
            disabled={pending}
          >
            Logga övrigt istället
          </button>
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

      {showForm ? (
        <div className={styles.form}>
          {hasLogged ? (
            <p className={styles.addMorePrompt}>Logga mer idag</p>
          ) : null}
          {canLogMore ? (
            <label className={styles.fieldLabel}>
              <span>Välj titel</span>
              <div className={styles.selectRow}>
                <select
                  className={styles.select}
                  value={selectedId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedId(nextId);
                    if (nextId === MEDIA_OTHER_SELECT_ID) {
                      setPosition("");
                      setDidConsume(false);
                      setReviewHighlight(false);
                      return;
                    }
                    setPosition(
                      finalePosition(media.items.find((i) => i.id === nextId)),
                    );
                    setDidConsume(false);
                    setReviewHighlight(false);
                  }}
                  disabled={pending}
                >
                  {media.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {MEDIA_KIND_ICON[item.kind]} {mediaDisplayTitle(item)}
                    </option>
                  ))}
                  <option value={MEDIA_OTHER_SELECT_ID}>Övrigt</option>
                </select>
                {selected && !loggingOther ? (
                  <MediaItemQuickEdit item={selected} />
                ) : null}
              </div>
            </label>
          ) : (
            <p className={styles.addMorePrompt}>Övrigt</p>
          )}

          <button
            type="button"
            className={styles.newTitleLink}
            onClick={openCreate}
            disabled={pending}
          >
            + Ny bok / film / serie
          </button>

          {loggingOther ? (
            <>
              <label className={styles.fieldLabel}>
                <span>Vad var det?</span>
                <select
                  className={styles.select}
                  value={otherKind}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (
                      MEDIA_OTHER_KINDS.some((kind) => kind === next)
                    ) {
                      setOtherKind(next as MediaOtherKind);
                    }
                  }}
                  disabled={pending}
                >
                  {MEDIA_OTHER_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {MEDIA_OTHER_KIND_ICON[kind]} {MEDIA_OTHER_KIND_LABEL[kind]}
                    </option>
                  ))}
                </select>
              </label>
              {otherKind === "other" ? (
                <Input
                  label="Vad är det?"
                  value={otherLabel}
                  onChange={(e) => setOtherLabel(e.target.value)}
                  placeholder="t.ex. serietidning"
                  maxLength={80}
                  disabled={pending}
                />
              ) : null}
              <Input
                label="Kommentar"
                value={otherNote}
                onChange={(e) => setOtherNote(e.target.value)}
                placeholder="Vad läste eller tittade du på?"
                maxLength={280}
                disabled={pending}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending}
                disabled={pending}
                onClick={saveOther}
              >
                Spara
              </Button>
            </>
          ) : selected && selected.kind !== "movie" && selected.totalLength ? (
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

          {!loggingOther && selected?.kind === "movie" ? (
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={didConsume}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDidConsume(checked);
                  if (variant !== "card" || !selected) return;
                  if (checked && selected.rating == null) return;
                  save(selectedId, "0", checked);
                }}
                disabled={pending}
              />
              Såg filmen idag
            </label>
          ) : !loggingOther && selected ? (
            <>
              <Input
                label={mediaPositionLabel(selected.kind)}
                type="number"
                inputMode="numeric"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                onBlur={
                  variant === "card"
                    ? () => {
                        if (
                          selected &&
                          isMediaFinaleLog(
                            selected,
                            position.trim() === "" ? 0 : Number(position),
                            didConsume,
                          )
                        ) {
                          return;
                        }
                        save(selectedId, position, didConsume);
                      }
                    : undefined
                }
                placeholder={
                  selected?.kind === "book" ? "t.ex. 142" : "t.ex. 5"
                }
                disabled={pending}
              />
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={didConsume}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDidConsume(checked);
                    if (variant !== "card" || !selected) return;
                    const pos =
                      position.trim() === "" ? 0 : Number(position);
                    if (isMediaFinaleLog(selected, pos, checked)) return;
                    save(selectedId, position, checked);
                  }}
                  disabled={pending}
                />
                {selected.kind === "book" ? "Läste idag" : "Tittade idag"}
              </label>
            </>
          ) : null}

          {showInlineReview && selected ? (
            <p className={styles.completeHint}>
              {selected.kind === "book"
                ? "Spara sidan för att markera boken som klar och skriva en recension."
                : null}
            </p>
          ) : null}

          {awaitingFinishChoice && selected ? (
            <div className={styles.choice}>
              <p className={styles.completeHint}>
                {selected.kind === "series"
                  ? "Sista avsnittet. Utan betyg är säsongen inte klar, och du kan logga det igen en annan dag."
                  : "Utan betyg är filmen inte klar, och du kan logga att du sett den igen."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                loading={pending}
                disabled={pending}
                onClick={() => save(selectedId, position, didConsume, false)}
              >
                {selected.kind === "series" ? "Tittar fortfarande" : "Inte klar än"}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                loading={pending}
                disabled={pending}
                onClick={() => save(selectedId, position, didConsume, true)}
              >
                Klar — ge betyg
              </Button>
            </div>
          ) : null}

          {!loggingOther && variant === "plan" && !awaitingFinishChoice ? (
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
