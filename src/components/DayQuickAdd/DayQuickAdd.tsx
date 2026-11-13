"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { quickAddDayActivityAction } from "@/app/(app)/day-quick-add-actions";
import { WeeklyTaskQuickAdd } from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  buildDayQuickAddItems,
  type DayQuickAddItem,
  type DayQuickAddPayload,
  type DayQuickAddSources,
  type DayQuickAddStep,
  type DayQuickAddTask,
} from "@/lib/day-quick-add";
import {
  MUSIC_ACTIVITY_LABEL,
  MUSIC_BANDS,
  MUSIC_OTHER_BAND,
  type MusicActivity,
  type TaskCategory,
  type Weekday,
} from "@/lib/tasks";
import type { UserGame } from "@/lib/games";
import type { UserSport } from "@/lib/sports";
import styles from "./DayQuickAdd.module.scss";

interface Props {
  weekStart: string;
  weekday: Weekday;
  categories: TaskCategory[];
  tasks: DayQuickAddTask[];
  sources: DayQuickAddSources;
  games: UserGame[];
  sports: UserSport[];
  onCancel: () => void;
  onAdded: () => void;
  /** True once a save has started. Stays true on success so the list can wait. */
  onListPending?: (pending: boolean) => void;
}

type View =
  | { type: "menu"; title: string; items: DayQuickAddItem[]; emptyHint?: string }
  | { type: "oneOff" }
  | { type: "band"; taskId: string; activity: MusicActivity; thenList: boolean }
  | { type: "callOther"; taskId: string }
  | {
      type: "list";
      title: string;
      payload: Extract<DayQuickAddPayload, { kind: "task" }>;
    };

export function DayQuickAdd({
  weekStart,
  weekday,
  categories,
  tasks,
  sources,
  games,
  sports,
  onCancel,
  onAdded,
  onListPending,
}: Props) {
  const rootItems = buildDayQuickAddItems({
    tasks,
    categories,
    sources,
    games,
    sports,
  });
  const [views, setViews] = useState<View[]>([
    { type: "menu", title: "Lägg till", items: rootItems },
  ]);
  const [bandText, setBandText] = useState("");
  const [otherName, setOtherName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const view = views[views.length - 1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const push = (next: View) => {
    setError(null);
    setBandText("");
    setOtherName("");
    setViews((prev) => [...prev, next]);
  };

  const back = () => {
    setError(null);
    if (views.length <= 1) {
      onCancel();
      return;
    }
    setViews((prev) => prev.slice(0, -1));
  };

  const commit = (payload: DayQuickAddPayload, listText?: string | null) => {
    setError(null);
    onListPending?.(true);
    startTransition(async () => {
      const res = await quickAddDayActivityAction({
        weekStart,
        weekday,
        payload,
        listText,
      });
      if (!res.ok) {
        onListPending?.(false);
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      onAdded();
    });
  };

  const openStep = (step: DayQuickAddStep) => {
    if (step.type === "commit") {
      commit(step.payload);
      return;
    }
    if (step.type === "oneOff") {
      push({ type: "oneOff" });
      return;
    }
    if (step.type === "band") {
      push({
        type: "band",
        taskId: step.taskId,
        activity: step.activity,
        thenList: step.thenList,
      });
      return;
    }
    if (step.type === "callOther") {
      push({ type: "callOther", taskId: step.taskId });
      return;
    }
    if (step.type === "list") {
      push({ type: "list", title: step.title, payload: step.payload });
      return;
    }
    push({
      type: "menu",
      title: step.title,
      items: step.items,
      emptyHint: step.emptyHint,
    });
  };

  const title =
    view.type === "menu"
      ? view.title
      : view.type === "oneOff"
        ? "Engångsuppgift"
        : view.type === "band"
          ? MUSIC_ACTIVITY_LABEL[view.activity]
          : view.type === "list"
            ? view.title
            : "Ring övrigt";

  return createPortal(
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-quick-add-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          {views.length > 1 ? (
            <button type="button" className={styles.back} onClick={back} disabled={pending}>
              Tillbaka
            </button>
          ) : null}
          <h2 id="day-quick-add-title" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            disabled={pending}
            aria-label="Stäng"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>
          {error ? <p className={styles.error}>{error}</p> : null}
          {pending ? (
            <p className={styles.waiting} role="status">
              <span className={styles.spinner} aria-hidden />
              Lägger till…
            </p>
          ) : null}

          {view.type === "oneOff" ? (
            <WeeklyTaskQuickAdd
              weekStart={weekStart}
              weekday={weekday}
              categories={categories}
              tasks={tasks}
              games={games}
              alwaysOpen
              onCancel={back}
              onPending={onListPending}
              onAdded={onAdded}
            />
          ) : null}

          {view.type === "menu" ? (
            view.items.length === 0 ? (
              <p className={styles.hint}>{view.emptyHint ?? "Inget att välja."}</p>
            ) : (
              <div className={styles.choices}>
                {view.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.choice}
                    disabled={pending}
                    onClick={() => openStep(item.step)}
                  >
                    <span aria-hidden>{item.icon}</span>
                    <span className={styles.choiceLabel}>{item.label}</span>
                    {item.progress ? (
                      <span
                        className={[
                          styles.progress,
                          item.progress.done >= item.progress.goal
                            ? styles.progressMet
                            : styles.progressShort,
                        ].join(" ")}
                        title={`${item.progress.done} av ${item.progress.goal} klara den här veckan`}
                      >
                        {item.progress.done}/{item.progress.goal}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )
          ) : null}

          {view.type === "band" ? (
            <BandStep
              pending={pending}
              bandText={bandText}
              onBandText={setBandText}
              onPick={(band) => {
                const payload = {
                  kind: "task" as const,
                  taskId: view.taskId,
                  musicActivity: view.activity,
                  band,
                };
                if (view.thenList) {
                  push({
                    type: "list",
                    title: MUSIC_ACTIVITY_LABEL[view.activity],
                    payload,
                  });
                  return;
                }
                commit(payload);
              }}
            />
          ) : null}

          {view.type === "list" ? (
            <ListStep
              title={view.title}
              pending={pending}
              onAdd={(listText) => commit(view.payload, listText)}
            />
          ) : null}

          {view.type === "callOther" ? (
            <div>
              <Input
                label="Vem ringer du?"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="t.ex. en vän"
                maxLength={80}
                disabled={pending}
                autoFocus
              />
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  loading={pending}
                  disabled={pending}
                  onClick={() =>
                    commit({
                      kind: "task",
                      taskId: view.taskId,
                      callPerson: "ovrigt",
                      callOtherName: otherName.trim() || null,
                    })
                  }
                >
                  Lägg till
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ListStep({
  title,
  pending,
  onAdd,
}: {
  title: string;
  pending: boolean;
  onAdd: (listText: string | null) => void;
}) {
  const [putInList, setPutInList] = useState(false);
  const [text, setText] = useState("");

  return (
    <div className={styles.listStep}>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={putInList}
          disabled={pending}
          onChange={(e) => setPutInList(e.target.checked)}
        />
        <span className={styles.checkText}>
          Lägg i lista
          <span className={styles.checkHint}>
            Hamnar överst i {title}, och {title} läggs på dagen.
          </span>
        </span>
      </label>
      {putInList ? (
        <Input
          label="Vad ska du göra"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`t.ex. vad du ska göra på ${title.toLowerCase()}`}
          maxLength={200}
          disabled={pending}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              e.preventDefault();
              onAdd(text.trim());
            }
          }}
        />
      ) : null}
      <div className={styles.actions}>
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={pending}
          disabled={pending || (putInList && !text.trim())}
          onClick={() => onAdd(putInList ? text.trim() : null)}
        >
          Lägg till
        </Button>
      </div>
    </div>
  );
}

function BandStep({
  pending,
  bandText,
  onBandText,
  onPick,
}: {
  pending: boolean;
  bandText: string;
  onBandText: (value: string) => void;
  onPick: (band: string | null) => void;
}) {
  const [other, setOther] = useState(false);

  return (
    <div className={styles.choices}>
      {MUSIC_BANDS.map((band) => (
        <button
          key={band}
          type="button"
          className={styles.choice}
          disabled={pending}
          onClick={() => onPick(band)}
        >
          {band}
        </button>
      ))}
      <button
        type="button"
        className={styles.choice}
        disabled={pending}
        onClick={() => setOther(true)}
      >
        {MUSIC_OTHER_BAND}
      </button>
      <button
        type="button"
        className={styles.choice}
        disabled={pending}
        onClick={() => onPick(null)}
      >
        Utan band
      </button>
      {other ? (
        <>
          <Input
            label="Konstellation"
            value={bandText}
            onChange={(e) => onBandText(e.target.value)}
            placeholder="t.ex. akustisk duo"
            maxLength={80}
            disabled={pending}
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            loading={pending}
            disabled={pending || !bandText.trim()}
            onClick={() => onPick(bandText.trim())}
          >
            Lägg till
          </Button>
        </>
      ) : null}
    </div>
  );
}
