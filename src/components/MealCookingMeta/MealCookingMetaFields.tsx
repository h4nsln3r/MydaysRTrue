"use client";

import { Input } from "@/components/Input/Input";
import {
  MEAL_COOKED_BY_LABEL,
  MEAL_COOKED_BY_ORDER,
  mealShowsMealBoxes,
  type MealCookedBy,
  type MealRestaurant,
} from "@/lib/habits";
import type { MealBoxStockItem } from "@/lib/habits";
import cardStyles from "@/components/MealsCard/MealsCard.module.scss";
import planStyles from "@/components/WeeklyTasksDayCard/WeeklyTasksDayCard.module.scss";

export interface MealCookingMetaState {
  cookedBy: MealCookedBy | null;
  restaurantId: string | null;
  restaurantName: string;
  cookedByName: string;
  mealBoxes: string;
  mealBoxStockId: string | null;
}

export function initialMealCookingMeta(
  entry: {
    cookedBy?: MealCookedBy | null;
    restaurantId?: string | null;
    restaurantName?: string | null;
    cookedByName?: string | null;
    mealBoxes?: number | null;
    fromMealBox?: boolean;
    mealBoxStockId?: string | null;
  } | null,
): MealCookingMetaState {
  return {
    cookedBy: entry?.fromMealBox
      ? "meal_box"
      : (entry?.cookedBy ?? null),
    restaurantId: entry?.restaurantId ?? null,
    restaurantName: entry?.restaurantName ?? "",
    cookedByName: entry?.cookedByName ?? "",
    mealBoxes: entry?.mealBoxes ? String(entry.mealBoxes) : "",
    mealBoxStockId: entry?.fromMealBox ? (entry.mealBoxStockId ?? null) : null,
  };
}

export function validateMealCookingMeta(
  meta: MealCookingMetaState,
): {
  ok: true;
  mealBoxes: number | null;
  mealBoxStockId: string | null;
  descriptionFromStock: string | null;
} | { ok: false; error: string } {
  if (!meta.cookedBy) {
    return { ok: false, error: "Välj vem som lagade maten." };
  }

  if (meta.cookedBy === "meal_box") {
    if (!meta.mealBoxStockId) {
      return { ok: false, error: "Välj vilken matlåda du åt." };
    }
    return {
      ok: true,
      mealBoxes: null,
      mealBoxStockId: meta.mealBoxStockId,
      descriptionFromStock: null,
    };
  }

  if (meta.cookedBy === "restaurant") {
    const hasSaved = Boolean(meta.restaurantId);
    const hasName = meta.restaurantName.trim().length > 0;
    if (!hasSaved && !hasName) {
      return { ok: false, error: "Skriv eller välj en restaurang." };
    }
  }

  if (meta.cookedBy === "other" && !meta.cookedByName.trim()) {
    return { ok: false, error: "Skriv vem som lagade maten." };
  }

  if (mealShowsMealBoxes(meta.cookedBy) && meta.mealBoxes.trim() !== "") {
    const parsedBoxes = Number(meta.mealBoxes);
    if (!Number.isFinite(parsedBoxes) || parsedBoxes < 0) {
      return { ok: false, error: "Antal matlådor måste vara 0 eller mer." };
    }
    if (parsedBoxes > 30) {
      return { ok: false, error: "Max 30 matlådor." };
    }
    return {
      ok: true,
      mealBoxes: parsedBoxes > 0 ? parsedBoxes : null,
      mealBoxStockId: null,
      descriptionFromStock: null,
    };
  }

  return {
    ok: true,
    mealBoxes: null,
    mealBoxStockId: null,
    descriptionFromStock: null,
  };
}

interface Props {
  layout: "card" | "plan";
  meta: MealCookingMetaState;
  savedRestaurants: MealRestaurant[];
  mealBoxStock?: MealBoxStockItem[];
  pending?: boolean;
  onChange: (next: MealCookingMetaState) => void;
  onPickMealBox?: (description: string) => void;
}

export function MealCookingMetaFields({
  layout,
  meta,
  savedRestaurants,
  mealBoxStock = [],
  pending = false,
  onChange,
  onPickMealBox,
}: Props) {
  const styles = layout === "card" ? cardStyles : planStyles;
  const showMealBoxes = mealShowsMealBoxes(meta.cookedBy);
  const showMealBoxPicker = meta.cookedBy === "meal_box";
  const showRestaurant = meta.cookedBy === "restaurant";
  const showOtherName = meta.cookedBy === "other";
  const restaurantListId = "meal-restaurant-suggestions";

  const setCookedBy = (option: MealCookedBy) => {
    onChange({
      ...meta,
      cookedBy: option,
      restaurantId: option === "restaurant" ? meta.restaurantId : null,
      restaurantName: option === "restaurant" ? meta.restaurantName : "",
      cookedByName: option === "other" ? meta.cookedByName : "",
      mealBoxes: mealShowsMealBoxes(option) ? meta.mealBoxes : "",
      mealBoxStockId: option === "meal_box" ? meta.mealBoxStockId : null,
    });
  };

  const pickMealBox = (item: MealBoxStockItem) => {
    onChange({
      ...meta,
      mealBoxStockId: item.id,
    });
    onPickMealBox?.(item.description);
  };

  const pickRestaurant = (restaurant: MealRestaurant) => {
    onChange({
      ...meta,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    });
  };

  return (
    <>
      <div className={layout === "card" ? styles.cookBlock : styles.bandPicker}>
        <span className={layout === "card" ? styles.label : styles.bandLabel}>
          Vem lagade maten?
        </span>
        <div className={layout === "card" ? styles.cookRow : styles.bandBtns}>
          {MEAL_COOKED_BY_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              className={
                layout === "card"
                  ? styles.cookOption
                  : [
                      styles.bandBtn,
                      meta.cookedBy === option ? styles.bandBtnActive : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
              }
              aria-pressed={meta.cookedBy === option}
              onClick={() => setCookedBy(option)}
              disabled={pending}
            >
              {MEAL_COOKED_BY_LABEL[option]}
            </button>
          ))}
        </div>
      </div>

      {showMealBoxPicker ? (
        <div className={layout === "card" ? styles.mealBoxPicker : styles.bandPicker}>
          <span className={layout === "card" ? styles.label : styles.bandLabel}>
            Vilken matlåda?
          </span>
          {mealBoxStock.length > 0 ? (
            <div className={layout === "card" ? styles.cookRow : styles.bandBtns}>
              {mealBoxStock.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    layout === "card"
                      ? styles.cookOption
                      : [
                          styles.bandBtn,
                          meta.mealBoxStockId === item.id
                            ? styles.bandBtnActive
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")
                  }
                  aria-pressed={meta.mealBoxStockId === item.id}
                  onClick={() => pickMealBox(item)}
                  disabled={pending}
                >
                  {item.description}
                  <span className={styles.mealBoxCount}>{item.remaining} kvar</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={layout === "card" ? styles.mealBoxEmpty : styles.error}>
              Inga matlådor i kylen just nu. Logga matlagning med antal matlådor
              först.
            </p>
          )}
        </div>
      ) : null}

      {showRestaurant ? (
        <div className={layout === "card" ? styles.restaurantBlock : undefined}>
          {savedRestaurants.length > 0 ? (
            <div className={layout === "card" ? styles.savedRestaurants : styles.bandPicker}>
              <span className={layout === "card" ? styles.label : styles.bandLabel}>
                Tidigare restauranger
              </span>
              <div className={layout === "card" ? styles.cookRow : styles.bandBtns}>
                {savedRestaurants.map((restaurant) => (
                  <button
                    key={restaurant.id}
                    type="button"
                    className={
                      layout === "card"
                        ? styles.cookOption
                        : [
                            styles.bandBtn,
                            meta.restaurantId === restaurant.id
                              ? styles.bandBtnActive
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")
                    }
                    aria-pressed={meta.restaurantId === restaurant.id}
                    onClick={() => pickRestaurant(restaurant)}
                    disabled={pending}
                  >
                    {restaurant.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Input
            label="Restaurang"
            value={meta.restaurantName}
            onChange={(e) => {
              const value = e.target.value;
              const match = savedRestaurants.find(
                (r) => r.name.toLowerCase() === value.trim().toLowerCase(),
              );
              onChange({
                ...meta,
                restaurantName: value,
                restaurantId: match?.id ?? null,
              });
            }}
            placeholder="t.ex. Sushi Palace"
            list={savedRestaurants.length > 0 ? restaurantListId : undefined}
            maxLength={120}
            disabled={pending}
          />
          {savedRestaurants.length > 0 ? (
            <datalist id={restaurantListId}>
              {savedRestaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.name} />
              ))}
            </datalist>
          ) : null}
        </div>
      ) : null}

      {showOtherName ? (
        <Input
          label="Vem lagade?"
          value={meta.cookedByName}
          onChange={(e) =>
            onChange({ ...meta, cookedByName: e.target.value })
          }
          placeholder="t.ex. mamma, kompis"
          maxLength={80}
          disabled={pending}
        />
      ) : null}

      {showMealBoxes ? (
        <Input
          label="Matlådor (valfritt)"
          type="number"
          min={0}
          max={30}
          step={1}
          inputMode="numeric"
          value={meta.mealBoxes}
          onChange={(e) => onChange({ ...meta, mealBoxes: e.target.value })}
          placeholder="0"
          hint={layout === "card" ? "Hur många matlådor blev det, om några?" : undefined}
          disabled={pending}
        />
      ) : null}
    </>
  );
}
