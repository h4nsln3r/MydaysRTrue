"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateMediaItemAction } from "@/app/(app)/media-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { mediaCompletionDate } from "@/lib/completions";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  type MediaItem,
} from "@/lib/media";
import styles from "./MediaItemQuickEdit.module.scss";

interface Props {
  item: MediaItem;
  className?: string;
}

/** Pencil that opens a modal to edit title, credits, and pages/episodes. */
export function MediaItemQuickEdit({ item, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={[styles.pencil, className].filter(Boolean).join(" ")}
        onClick={() => setOpen(true)}
        aria-label={`Redigera ${item.title}`}
      >
        ✎
      </button>
      {open ? (
        <MediaItemEditModal item={item} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function MediaItemEditModal({
  item,
  onClose,
}: {
  item: MediaItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const close = useCallback(() => onClose(), [onClose]);
  const [title, setTitle] = useState(item.title);
  const [author, setAuthor] = useState(item.author ?? "");
  const [director, setDirector] = useState(item.director ?? "");
  const [actors, setActors] = useState(item.actors ?? "");
  const [totalLength, setTotalLength] = useState(
    item.totalLength != null ? String(item.totalLength) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setTitle(item.title);
    setAuthor(item.author ?? "");
    setDirector(item.director ?? "");
    setActors(item.actors ?? "");
    setTotalLength(item.totalLength != null ? String(item.totalLength) : "");
    setError(null);
  }, [item]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const currentLength =
    item.totalLength != null ? String(item.totalLength) : "";
  const dirty =
    title.trim() !== item.title.trim() ||
    (item.kind === "book" && author.trim() !== (item.author ?? "").trim()) ||
    (item.kind === "movie" &&
      (director.trim() !== (item.director ?? "").trim() ||
        actors.trim() !== (item.actors ?? "").trim())) ||
    (item.kind !== "movie" && totalLength.trim() !== currentLength);

  const save = () => {
    if (!title.trim()) {
      setError("Skriv en titel.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateMediaItemAction({
        id: item.id,
        title,
        author: item.kind === "book" ? author : undefined,
        director: item.kind === "movie" ? director : undefined,
        actors: item.kind === "movie" ? actors : undefined,
        note: item.note ?? "",
        rating: item.rating,
        totalLength:
          item.kind === "movie"
            ? null
            : totalLength.trim() === ""
              ? undefined
              : Number(totalLength),
        completedOn: item.completed
          ? (mediaCompletionDate(item) ?? undefined)
          : undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      router.refresh();
      close();
    });
  };

  if (typeof document === "undefined") return null;

  const progressHint =
    item.kind !== "movie" && item.bestPosition > 0
      ? `Du är på ${item.kind === "book" ? "sida" : "avsnitt"} ${item.bestPosition} — totalen måste vara minst så hög.`
      : null;

  return createPortal(
    <div className={styles.backdrop} onClick={close}>
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
              Redigera
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label="Stäng"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>
          <Input
            label="Titel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            disabled={pending}
          />
          {item.kind === "book" ? (
            <Input
              label="Författare (valfritt)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              maxLength={120}
              disabled={pending}
            />
          ) : null}
          {item.kind === "movie" ? (
            <>
              <Input
                label="Regissör (valfritt)"
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                maxLength={120}
                disabled={pending}
              />
              <Input
                label="Skådespelare (valfritt)"
                value={actors}
                onChange={(e) => setActors(e.target.value)}
                maxLength={120}
                disabled={pending}
              />
            </>
          ) : (
            <Input
              label={item.kind === "book" ? "Antal sidor" : "Antal avsnitt"}
              type="number"
              inputMode="numeric"
              value={totalLength}
              onChange={(e) => setTotalLength(e.target.value)}
              hint={progressHint ?? undefined}
              disabled={pending}
            />
          )}
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
              variant="primary"
              size="md"
              loading={pending}
              disabled={pending || !dirty}
              onClick={save}
            >
              Spara
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
