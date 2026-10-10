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
import { MealLogExtras } from "@/components/MealLogExtras/MealLogExtras";
import { parseFoodDrink, parseFoodRating } from "@/lib/meal-log";
import { saveMealAction } from "@/app/(app)/actions";
import styles from "./MealsCard.module.scss";

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
  const [drinkNote, setDrinkNote] = useState(initial?.drinkNote ?? "");
  const [rating, setRating] = useState(
    initial?.rating != null ? String(initial.rating) : "",
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

    const drink = parseFoodDrink(waterMl, drinkNote);
    if (!drink.ok) {
      setError(drink.error);
      return;
    }
    const foodRating = parseFoodRating(rating);
    if (!foodRating.ok) {
      setError(foodRating.error);
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
        waterMl: drink.waterMl,
        drinkNote: drink.drinkNote,
        rating: foodRating.rating,
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

      <MealLogExtras
        waterMl={waterMl}
        drinkNote={drinkNote}
        rating={rating}
        disabled={pending}
        resetKey={`${date}:${meal}:${initial?.id ?? "new"}`}
        onWaterMl={setWaterMl}
        onDrinkNote={setDrinkNote}
        onRating={setRating}
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
