"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveMediaItemAction,
  createMediaItemAction,
} from "@/app/(app)/media-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  MEDIA_KIND_ICON,
  MEDIA_KIND_LABEL,
  mediaProgressLabel,
  type MediaKind,
  type YearMediaContext,
} from "@/lib/media";
import styles from "./MediaYearBoard.module.scss";

const KINDS: MediaKind[] = ["book", "series", "movie"];

interface Props {
  yearMedia: YearMediaContext;
}

export function MediaYearBoard({ yearMedia }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<MediaKind>("book");
  const [title, setTitle] = useState("");
  const [totalLength, setTotalLength] = useState("");

  const add = () => {
    if (!title.trim()) {
      setError("Skriv en titel.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createMediaItemAction({
        year: yearMedia.year,
        kind,
        title,
        totalLength:
          kind === "movie"
            ? null
            : totalLength.trim() === ""
              ? undefined
              : Number(totalLength),
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setTitle("");
      setTotalLength("");
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await archiveMediaItemAction(id);
      if (!res.ok) setError(res.error ?? "Kunde inte ta bort.");
      router.refresh();
    });
  };

  return (
    <div className={styles.board}>
      <p className={styles.hint}>
        Lägg till böcker, serier och filmer för {yearMedia.year}. I dagsvyn
        väljer du titel och loggar sida eller avsnitt.
      </p>

      {yearMedia.items.length > 0 ? (
        <ul className={styles.list}>
          {yearMedia.items.map((item) => (
            <li key={item.id} className={styles.item}>
              <span className={styles.itemIcon} aria-hidden>
                {MEDIA_KIND_ICON[item.kind]}
              </span>
              <div className={styles.itemMeta}>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemSub}>
                  {MEDIA_KIND_LABEL[item.kind]}
                  {item.totalLength
                    ? item.kind === "book"
                      ? ` · ${item.totalLength} sidor`
                      : ` · ${item.totalLength} avsnitt`
                    : ""}
                  {mediaProgressLabel(item)
                    ? ` · ${mediaProgressLabel(item)}`
                    : ""}
                </span>
              </div>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => remove(item.id)}
                disabled={pending}
              >
                Ta bort
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Inget tillagt ännu.</p>
      )}

      <div className={styles.form}>
        <p className={styles.hint}>Lägg till</p>
        <div className={styles.kindRow} role="radiogroup" aria-label="Typ">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              aria-pressed={kind === k}
              className={styles.kindBtn}
              onClick={() => setKind(k)}
              disabled={pending}
            >
              {MEDIA_KIND_ICON[k]} {MEDIA_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <Input
          label="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            kind === "book"
              ? "t.ex. Dune"
              : kind === "series"
                ? "t.ex. Breaking Bad"
                : "t.ex. Inception"
          }
          maxLength={120}
          disabled={pending}
        />
        {kind !== "movie" ? (
          <Input
            label={kind === "book" ? "Antal sidor" : "Antal avsnitt"}
            type="number"
            inputMode="numeric"
            value={totalLength}
            onChange={(e) => setTotalLength(e.target.value)}
            placeholder={kind === "book" ? "t.ex. 412" : "t.ex. 62"}
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
          onClick={add}
        >
          Lägg till
        </Button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
