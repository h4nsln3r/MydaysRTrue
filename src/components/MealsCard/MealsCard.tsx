"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  MEAL_ICON,
  MEAL_LABEL,
  MEAL_ORDER,
  SNACK_ICON,
  SNACK_LABEL,
  SNACK_SLOTS,
  mealCookedByDisplay,
  mealHasCookingMeta,
  type DailySnacks,
  type MealCookedBy,
  type MealEntry,
  type MealKey,
  type MealRestaurant,
  type SnackEntry,
  type SnackSlot,
} from "@/lib/habits";
import {
  MealCookingMetaFields,
  initialMealCookingMeta,
  validateMealCookingMeta,
} from "@/components/MealCookingMeta/MealCookingMetaFields";
import { formatMl } from "@/lib/water";
import {
  clearMealAction,
  clearSnackAction,
  saveMealAction,
  saveSnackAction,
} from "@/app/(app)/actions";
import styles from "./MealsCard.module.scss";

interface Props {
  date: string;
  meals: Record<MealKey, MealEntry | null>;
  snacks: DailySnacks;
  savedRestaurants?: MealRestaurant[];
  showMeals?: boolean;
  showSnacks?: boolean;
}

const WATER_PRESETS = [200, 330, 500];

type EditKey = `meal:${MealKey}` | `snack:${SnackSlot}`;

export function MealsCard({
  date,
  meals,
  snacks,
  savedRestaurants = [],
  showMeals = true,
  showSnacks = true,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmingClear, setConfirmingClear] = useState<EditKey | null>(null);

  const close = () => setEditing(null);

  const onSaved = () => {
    close();
    router.refresh();
  };

  const clearMeal = (meal: MealKey) => {
    startTransition(async () => {
      const res = await clearMealAction({ meal, localDate: date });
      if (res.ok) {
        setConfirmingClear(null);
        router.refresh();
      }
    });
  };

  const clearSnack = (slot: SnackSlot) => {
    startTransition(async () => {
      const res = await clearSnackAction({ localDate: date, slot });
      if (res.ok) {
        setConfirmingClear(null);
        router.refresh();
      }
    });
  };

  const mealsLogged = showMeals ? MEAL_ORDER.filter((k) => meals[k]).length : 0;
  const snacksLogged = showSnacks
    ? SNACK_SLOTS.filter((slot) => snacks[slot]).length
    : 0;
  const totalSlots =
    (showMeals ? MEAL_ORDER.length : 0) + (showSnacks ? SNACK_SLOTS.length : 0);
  const logged = mealsLogged + snacksLogged;
  const title =
    showMeals && showSnacks
      ? "Måltider"
      : showMeals
        ? "Måltider"
        : "Mellanmål";

  return (
    <Card className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{title}</h2>
          <span
            className={[
              styles.counter,
              logged === totalSlots && totalSlots > 0 ? styles.counterDone : "",
              logged > 0 && logged < totalSlots ? styles.counterPartial : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.counterBig}>{logged}</span>
            <span className={styles.counterSlash}>/ {totalSlots}</span>
          </span>
        </div>
        <p className={styles.subtitle}>
          {showMeals && showSnacks
            ? "Logga måltider och mellanmål med vad du åt."
            : showMeals
              ? "Tryck på varje måltid och skriv vad du åt."
              : "Logga mellanmål med vad de innehöll."}
        </p>
      </header>

      <ul className={styles.list}>
        {showMeals
          ? MEAL_ORDER.map((meal) => {
              const entry = meals[meal];
              const editKey: EditKey = `meal:${meal}`;
              const isEditing = editing === editKey;
              const isConfirming = confirmingClear === editKey;
              return (
                <li key={meal} className={styles.item}>
                  {isEditing ? (
                    <MealForm
                      meal={meal}
                      date={date}
                      initial={entry}
                      savedRestaurants={savedRestaurants}
                      onCancel={close}
                      onSaved={onSaved}
                    />
                  ) : entry ? (
                    <LoggedRow
                      icon={MEAL_ICON[meal]}
                      label={MEAL_LABEL[meal]}
                      description={entry.description}
                      waterMl={entry.waterMl}
                      cookedBy={entry.cookedBy}
                      restaurantName={entry.restaurantName}
                      cookedByName={entry.cookedByName}
                      mealBoxes={entry.mealBoxes}
                      pending={pending}
                      onEdit={() => setEditing(editKey)}
                      onClear={() => clearMeal(meal)}
                      confirmingClear={isConfirming}
                      onConfirmClear={() => setConfirmingClear(editKey)}
                      onCancelClear={() => setConfirmingClear(null)}
                      editLabel={`Redigera ${MEAL_LABEL[meal]}`}
                      clearLabel={`Ta bort ${MEAL_LABEL[meal]}`}
                    />
                  ) : (
                    <EmptyRow
                      icon={MEAL_ICON[meal]}
                      label={MEAL_LABEL[meal]}
                      hint="Tryck för att logga"
                      pending={pending}
                      onClick={() => setEditing(editKey)}
                      ariaLabel={`Logga ${MEAL_LABEL[meal]}`}
                    />
                  )}
                </li>
              );
            })
          : null}

        {showMeals && showSnacks ? (
          <li className={styles.divider} aria-hidden>
            <span>Mellanmål</span>
          </li>
        ) : null}

        {showSnacks
          ? SNACK_SLOTS.map((slot) => {
              const entry = snacks[slot];
              const editKey: EditKey = `snack:${slot}`;
              const isEditing = editing === editKey;
              const isConfirming = confirmingClear === editKey;
              return (
                <li key={`snack-${slot}`} className={styles.item}>
                  {isEditing ? (
                    <SnackForm
                      slot={slot}
                      date={date}
                      initial={entry}
                      onCancel={close}
                      onSaved={onSaved}
                    />
                  ) : entry ? (
                    <LoggedRow
                      icon={SNACK_ICON[slot]}
                      label={SNACK_LABEL[slot]}
                      description={entry.description}
                      pending={pending}
                      onEdit={() => setEditing(editKey)}
                      onClear={() => clearSnack(slot)}
                      confirmingClear={isConfirming}
                      onConfirmClear={() => setConfirmingClear(editKey)}
                      onCancelClear={() => setConfirmingClear(null)}
                      editLabel={`Redigera ${SNACK_LABEL[slot]}`}
                      clearLabel={`Ta bort ${SNACK_LABEL[slot]}`}
                    />
                  ) : (
                    <EmptyRow
                      icon={SNACK_ICON[slot]}
                      label={SNACK_LABEL[slot]}
                      hint="Tryck för att logga"
                      pending={pending}
                      onClick={() => setEditing(editKey)}
                      ariaLabel={`Logga ${SNACK_LABEL[slot]}`}
                    />
                  )}
                </li>
              );
            })
          : null}
      </ul>
    </Card>
  );
}

interface LoggedRowProps {
  icon: string;
  label: string;
  description: string;
  waterMl?: number;
  cookedBy?: MealCookedBy | null;
  restaurantName?: string | null;
  cookedByName?: string | null;
  mealBoxes?: number | null;
  pending: boolean;
  onEdit: () => void;
  onClear: () => void;
  confirmingClear: boolean;
  onConfirmClear: () => void;
  onCancelClear: () => void;
  editLabel: string;
  clearLabel: string;
}

function LoggedRow({
  icon,
  label,
  description,
  waterMl = 0,
  cookedBy = null,
  restaurantName = null,
  cookedByName = null,
  mealBoxes = null,
  pending,
  onEdit,
  onClear,
  confirmingClear,
  onConfirmClear,
  onCancelClear,
  editLabel,
  clearLabel,
}: LoggedRowProps) {
  return (
    <div className={[styles.row, styles.rowDone].join(" ")}>
      <button
        type="button"
        className={styles.rowMain}
        onClick={onEdit}
        aria-label={editLabel}
        disabled={pending}
      >
        <span className={styles.iconBox} aria-hidden data-state="done">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5 10 17.5 19 7.5"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.mealText}>
          <span className={styles.mealLabel}>
            <span className={styles.mealIcon} aria-hidden>
              {icon}
            </span>
            {label}
          </span>
          <span className={styles.description}>{description}</span>
        </span>
        {cookedBy || waterMl > 0 || (mealBoxes != null && mealBoxes > 0) ? (
          <span className={styles.metaBadges}>
            {cookedBy ? (
              <span
                className={[
                  styles.cookBadge,
                  cookedBy === "self"
                    ? styles.cookBadgeSelf
                    : cookedBy === "julia"
                      ? styles.cookBadgeJulia
                      : cookedBy === "restaurant"
                        ? styles.cookBadgeRestaurant
                        : cookedBy === "other"
                          ? styles.cookBadgeOther
                          : styles.cookBadgeBought,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {mealCookedByDisplay(cookedBy, restaurantName, cookedByName)}
              </span>
            ) : null}
            {mealBoxes != null && mealBoxes > 0 ? (
              <span className={styles.boxesBadge}>
                {mealBoxes} matlåd{mealBoxes === 1 ? "a" : "or"}
              </span>
            ) : null}
            {waterMl > 0 ? (
              <span className={styles.waterBadge} aria-label="Med vatten">
                💧 {formatMl(waterMl)}
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
      <span className={styles.clearWrap}>
        {confirmingClear ? (
          <span className={styles.confirmRow}>
            <button
              type="button"
              className={styles.confirmYes}
              onClick={onClear}
              disabled={pending}
              aria-label="Bekräfta borttagning"
            >
              Ta bort
            </button>
            <button
              type="button"
              className={styles.confirmNo}
              onClick={onCancelClear}
              disabled={pending}
              aria-label="Avbryt"
            >
              Avbryt
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onConfirmClear}
            aria-label={clearLabel}
            disabled={pending}
          >
            ×
          </button>
        )}
      </span>
    </div>
  );
}

interface EmptyRowProps {
  icon: string;
  label: string;
  hint: string;
  pending: boolean;
  onClick: () => void;
  ariaLabel: string;
}

function EmptyRow({ icon, label, hint, pending, onClick, ariaLabel }: EmptyRowProps) {
  return (
    <button
      type="button"
      className={[styles.row, styles.rowEmpty].join(" ")}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={pending}
    >
      <span className={styles.iconBox} aria-hidden data-state="empty" />
      <span className={styles.mealText}>
        <span className={styles.mealLabel}>
          <span className={styles.mealIcon} aria-hidden>
            {icon}
          </span>
          {label}
        </span>
        <span className={styles.mealHint}>{hint}</span>
      </span>
      <span className={styles.plus} aria-hidden>
        +
      </span>
    </button>
  );
}

interface MealFormProps {
  meal: MealKey;
  date: string;
  initial: MealEntry | null;
  savedRestaurants: MealRestaurant[];
  onCancel: () => void;
  onSaved: () => void;
}

function MealForm({
  meal,
  date,
  initial,
  savedRestaurants,
  onCancel,
  onSaved,
}: MealFormProps) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [waterMl, setWaterMl] = useState<string>(
    initial?.waterMl ? String(initial.waterMl) : "",
  );
  const [cookingMeta, setCookingMeta] = useState(() =>
    initialMealCookingMeta(initial),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showCookingMeta = mealHasCookingMeta(meal);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (showCookingMeta) {
      const cookingResult = validateMealCookingMeta(cookingMeta);
      if (!cookingResult.ok) {
        setError(cookingResult.error);
        return;
      }
    }

    const parsedWater = waterMl.trim() === "" ? 0 : Number(waterMl);
    if (!Number.isFinite(parsedWater) || parsedWater < 0) {
      setError("Vattnet måste vara ett positivt tal.");
      return;
    }

    const cookingResult = showCookingMeta
      ? validateMealCookingMeta(cookingMeta)
      : { ok: true as const, mealBoxes: null };
    if (!cookingResult.ok) {
      setError(cookingResult.error);
      return;
    }
    const parsedBoxes = cookingResult.mealBoxes;

    startTransition(async () => {
      const res = await saveMealAction({
        meal,
        localDate: date,
        description,
        waterMl: Math.round(parsedWater),
        cookedBy: showCookingMeta ? cookingMeta.cookedBy : null,
        mealBoxes: parsedBoxes,
        restaurantId:
          showCookingMeta && cookingMeta.cookedBy === "restaurant"
            ? cookingMeta.restaurantId
            : null,
        restaurantName:
          showCookingMeta && cookingMeta.cookedBy === "restaurant"
            ? cookingMeta.restaurantName
            : null,
        cookedByName:
          showCookingMeta && cookingMeta.cookedBy === "other"
            ? cookingMeta.cookedByName
            : null,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      onSaved();
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formHead}>
        <span className={styles.formTitle}>
          <span className={styles.mealIcon} aria-hidden>
            {MEAL_ICON[meal]}
          </span>
          {MEAL_LABEL[meal]}
        </span>
        <button
          type="button"
          className={styles.formClose}
          onClick={onCancel}
          aria-label="Avbryt"
          disabled={pending}
        >
          ×
        </button>
      </div>

      <Input
        label="Vad åt du?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="t.ex. yoghurt, banan, två skivor bröd"
        maxLength={280}
        autoFocus
        required
      />

      {showCookingMeta ? (
        <MealCookingMetaFields
          layout="card"
          meta={cookingMeta}
          savedRestaurants={savedRestaurants}
          pending={pending}
          onChange={setCookingMeta}
        />
      ) : null}

      <div className={styles.waterBlock}>
        <span className={styles.label}>Vatten till måltiden</span>
        <div className={styles.waterRow}>
          <Input
            type="number"
            min={0}
            max={5000}
            step={50}
            inputMode="numeric"
            value={waterMl}
            onChange={(e) => setWaterMl(e.target.value)}
            placeholder="0"
            suffix="ml"
          />
          <div className={styles.waterPresets}>
            {WATER_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={styles.waterPreset}
                aria-pressed={Number(waterMl) === p}
                onClick={() => setWaterMl(String(p))}
              >
                {p}
              </button>
            ))}
            {waterMl ? (
              <button
                type="button"
                className={[styles.waterPreset, styles.waterClear].join(" ")}
                onClick={() => setWaterMl("")}
                aria-label="Rensa vatten"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
        <p className={styles.hint}>Läggs till i vattenloggen med en notering.</p>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.formActions}>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={pending}
        >
          Avbryt
        </Button>
        <Button type="submit" variant="primary" size="md" loading={pending}>
          {initial ? "Spara" : "Markera äten"}
        </Button>
      </div>
    </form>
  );
}

interface SnackFormProps {
  slot: SnackSlot;
  date: string;
  initial: SnackEntry | null;
  onCancel: () => void;
  onSaved: () => void;
}

function SnackForm({ slot, date, initial, onCancel, onSaved }: SnackFormProps) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await saveSnackAction({
        slot,
        localDate: date,
        description,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      onSaved();
    });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.formHead}>
        <span className={styles.formTitle}>
          <span className={styles.mealIcon} aria-hidden>
            {SNACK_ICON[slot]}
          </span>
          {SNACK_LABEL[slot]}
        </span>
        <button
          type="button"
          className={styles.formClose}
          onClick={onCancel}
          aria-label="Avbryt"
          disabled={pending}
        >
          ×
        </button>
      </div>

      <Input
        label="Vad innehöll mellanmålet?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="t.ex. äpple och nötter, proteinbar"
        maxLength={280}
        autoFocus
        required
      />

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.formActions}>
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={onCancel}
          disabled={pending}
        >
          Avbryt
        </Button>
        <Button type="submit" variant="primary" size="md" loading={pending}>
          {initial ? "Spara" : "Markera äten"}
        </Button>
      </div>
    </form>
  );
}
