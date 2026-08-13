"use client";

import { Input } from "@/components/Input/Input";
import {
  MUSIC_ACTIVITIES,
  MUSIC_ACTIVITY_HINT,
  MUSIC_ACTIVITY_ICON,
  MUSIC_ACTIVITY_LABEL,
  MUSIC_BANDS,
  MUSIC_OTHER_BAND,
  isKnownMusicBand,
  musicActivityNeedsBand,
  type MusicActivity,
} from "@/lib/tasks";
import styles from "./MusicActivityFields.module.scss";

interface Props {
  activity: MusicActivity | null;
  onActivityChange: (activity: MusicActivity | null) => void;
  band: string | null;
  onBandChange: (band: string | null) => void;
  disabled?: boolean;
}

function bandChoice(band: string | null): "Totes" | "Bojeng" | "other" | null {
  if (!band) return null;
  if (isKnownMusicBand(band)) return band;
  return "other";
}

function otherBandText(band: string | null): string {
  if (!band || isKnownMusicBand(band) || band === MUSIC_OTHER_BAND) return "";
  return band;
}

export function MusicActivityFields({
  activity,
  onActivityChange,
  band,
  onBandChange,
  disabled = false,
}: Props) {
  const choice = bandChoice(band);
  const needsBand = musicActivityNeedsBand(activity);

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Vad ska du göra?</span>
      <div className={styles.btns}>
        {MUSIC_ACTIVITIES.map((item) => (
          <button
            key={item}
            type="button"
            className={[styles.btn, activity === item ? styles.btnActive : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={activity === item}
            disabled={disabled}
            onClick={() => onActivityChange(item)}
          >
            {MUSIC_ACTIVITY_ICON[item]} {MUSIC_ACTIVITY_LABEL[item]}
          </button>
        ))}
      </div>
      {activity ? <p className={styles.hint}>{MUSIC_ACTIVITY_HINT[activity]}</p> : null}

      {needsBand ? (
        <>
          <span className={styles.label}>
            {activity === "spelning"
              ? "Vilket band / konstellation?"
              : "Vilket band? (valfritt)"}
          </span>
          <div className={styles.btns}>
            {MUSIC_BANDS.map((b) => (
              <button
                key={b}
                type="button"
                className={[styles.btn, choice === b ? styles.btnActive : ""]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={choice === b}
                disabled={disabled}
                onClick={() => onBandChange(choice === b ? null : b)}
              >
                {b}
              </button>
            ))}
            <button
              type="button"
              className={[styles.btn, choice === "other" ? styles.btnActive : ""]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={choice === "other"}
              disabled={disabled}
              onClick={() =>
                onBandChange(choice === "other" ? null : MUSIC_OTHER_BAND)
              }
            >
              {MUSIC_OTHER_BAND}
            </button>
          </div>
          {choice === "other" ? (
            <Input
              label="Konstellation"
              value={otherBandText(band)}
              onChange={(e) => {
                const value = e.target.value.slice(0, 80);
                onBandChange(value.trim() ? value : MUSIC_OTHER_BAND);
              }}
              placeholder="t.ex. akustisk duo, coverband"
              maxLength={80}
              disabled={disabled}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
