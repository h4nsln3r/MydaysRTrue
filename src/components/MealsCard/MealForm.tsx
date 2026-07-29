"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  MEAL_ICON,
  MEAL_LABEL,
  mealHasCookingMeta,
  type MealEntry,
  type MealKey,
  type MealRestaurant,
  type MealBoxStockItem,
} from "@/lib/habits";
import {
  MealCookingMetaFields,
  initialMealCookingMeta,
  validateMealCookingMeta,
} from "@/components/MealCookingMeta/MealCookingMetaFields";
import { saveMealAction } from "@/app/(app)/actions";
import styles from "./MealsCard.module.scss";

const WATER_PRESETS = [200, 330, 500];

interface MealFormProps {
  meal: MealKey;
  date: string;
  initial: MealEntry | null;
  savedRestaurants: MealRestaurant[];
  mealBoxStock: MealBoxStockItem[];
  onCancel: () => void;
  onSaved: () => void;
}

export function MealForm({
  meal,
  date,
  initial,
  savedRestaurants,
  mealBoxStock,
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
  const eatingMealBox = showCookingMeta && cookingMeta.cookedBy === "meal_box";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedWater = waterMl.trim() === "" ? 0 : Number(waterMl);
    if (!Number.isFinite(parsedWater) || parsedWater < 0) {
      setError("Vattnet måste vara ett positivt tal.");
      return;
    }

    const cookingResult = showCookingMeta
      ? validateMealCookingMeta(cookingMeta)
      : {
          ok: true as const,
          mealBoxes: null,
          mealBoxStockId: null,
          descriptionFromStock: null,
        };
    if (!cookingResult.ok) {
      setError(cookingResult.error);
      return;
    }

    if (!eatingMealBox && !description.trim()) {
      setError("Skriv vad du åt.");
      return;
    }

    const stockItem =
      eatingMealBox && cookingResult.mealBoxStockId
        ? mealBoxStock.find((item) => item.id === cookingResult.mealBoxStockId)
        : null;

    startTransition(async () => {
      const res = await saveMealAction({
        meal,
        localDate: date,
        description: stockItem?.description ?? description,
        waterMl: Math.round(parsedWater),
        cookedBy: showCookingMeta ? cookingMeta.cookedBy : null,
        mealBoxes: cookingResult.mealBoxes,
        mealBoxStockId: cookingResult.mealBoxStockId,
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
        autoFocus={!eatingMealBox}
        required={!eatingMealBox}
        disabled={pending || eatingMealBox}
        hint={
          eatingMealBox
            ? "Fylls i automatiskt när du väljer matlåda nedan."
            : undefined
        }
      />

      {showCookingMeta ? (
        <MealCookingMetaFields
          layout="card"
          meta={cookingMeta}
          savedRestaurants={savedRestaurants}
          mealBoxStock={mealBoxStock}
          pending={pending}
          onChange={setCookingMeta}
          onPickMealBox={setDescription}
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
