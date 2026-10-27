import Link from "next/link";
import { MEAL_ORDER, type MealKey } from "@/lib/habits";
import {
  buildMealMonthSummary,
  type MealMonthDay,
  type MealMonthDishStat,
  type MealMonthSummaryModel,
} from "@/lib/meal-month-summary";
import { MealCookSplit } from "./MealCookSplit";
import styles from "./MealMonthSummary.module.scss";

const MEAL_LABEL_SV: Record<MealKey, string> = {
  breakfast: "Frukost",
  lunch: "Lunch",
  dinner: "Middag",
};

interface Props {
  days: MealMonthDay[];
  year: number;
  monthStart: string;
}

export function MealMonthSummary({ days, year, monthStart }: Props) {
  const summary = buildMealMonthSummary(days);
  const yearHref = `/year?y=${year}&view=progress#restauranger`;

  if (summary.mealCount === 0 && summary.snackCount === 0) {
    return (
      <section className={styles.section} aria-labelledby="meal-month-title">
        <header className={styles.header}>
          <h2 id="meal-month-title" className={styles.title}>
            Mat
          </h2>
        </header>
        <p className={styles.empty}>Ingen mat loggad den här månaden ännu.</p>
      </section>
    );
  }

  const slotLine = MEAL_ORDER.filter((meal) => summary.byMeal[meal] > 0)
    .map((meal) => `${MEAL_LABEL_SV[meal]} ${summary.byMeal[meal]}`)
    .join(" · ");

  return (
    <section className={styles.section} aria-labelledby="meal-month-title">
      <header className={styles.header}>
        <h2 id="meal-month-title" className={styles.title}>
          Mat
        </h2>
        {summary.eatOutCount > 0 ? (
          <Link href={yearHref} className={styles.link}>
            Årets restauranger →
          </Link>
        ) : null}
      </header>

      {summary.mealCount > 0 ? (
        <p className={styles.lede}>{lede(summary)}</p>
      ) : null}
      {slotLine ? <p className={styles.slots}>{slotLine}</p> : null}

      {summary.cookTotal > 0 ? (
        <MealCookSplit monthStart={monthStart} cook={summary.cook} />
      ) : null}

      <ul className={styles.notes}>
        <DishNotes summary={summary} />
        <BestNote summary={summary} />
        <EatOutNote summary={summary} />
        <BoxNote summary={summary} />
        <SnackNote summary={summary} />
        <DrinkNote summary={summary} />
        <OtherCookNote summary={summary} />
      </ul>
    </section>
  );
}

function DishNotes({ summary }: { summary: MealMonthSummaryModel }) {
  const repeated = summary.repeatedDishes;
  if (repeated.length === 0) {
    if (summary.mealCount === 1 && summary.onlyDish) {
      return <li>Du åt {summary.onlyDish}.</li>;
    }
    if (summary.uniqueDishCount > 1) {
      return <li>Inget återkom — {summary.uniqueDishCount} olika rätter.</li>;
    }
    return null;
  }

  const leaderCount = repeated[0]!.count;
  const leaders = repeated.filter((dish) => dish.count === leaderCount);
  const runners = repeated
    .filter((dish) => dish.count < leaderCount)
    .slice(0, 2);
  const shownLeaders = leaders.slice(0, 3);
  const hiddenLeaders = leaders.length - shownLeaders.length;

  return (
    <>
      <li>
        {leaders.length === 1 ? (
          <>
            Vanligast var {shownLeaders[0]!.name}, {gånger(shownLeaders[0]!.count)}
            {shownLeaders[0]!.averageRating != null
              ? `, snitt ${formatRating(shownLeaders[0]!.averageRating)}`
              : ""}
            .
          </>
        ) : (
          <>
            Vanligast var {joinNames(shownLeaders.map((dish) => dish.name))}
            {hiddenLeaders > 0
              ? ` och ${hiddenLeaders} till`
              : ""}
            , {gånger(leaderCount)} var.
          </>
        )}
      </li>
      {runners.length > 0 ? (
        <li>
          Också ofta{" "}
          {runners
            .map((dish) => `${dish.name}, ${gånger(dish.count)}`)
            .join(" och ")}
          .
        </li>
      ) : null}
    </>
  );
}

function BestNote({ summary }: { summary: MealMonthSummaryModel }) {
  const best = summary.best;
  if (!best) return null;
  const score = `${formatRating(best.rating)} av 10`;
  if (best.names.length === 1) {
    return (
      <li>
        Högst betyg fick {best.names[0]}
        {best.where ? ` på ${best.where}` : ""}, {score}.
      </li>
    );
  }
  const who = best.names.length === 2 ? "båda" : "alla";
  return (
    <li>
      Högst betyg fick {joinNames(best.names)}
      {best.extra > 0 ? ` och ${best.extra} till` : ""}, {who} {score}.
    </li>
  );
}

function EatOutNote({ summary }: { summary: MealMonthSummaryModel }) {
  if (summary.eatOutCount === 0) return null;
  const places = summary.restaurants;
  if (places.length === 0) {
    return <li>Ute {gånger(summary.eatOutCount)}.</li>;
  }
  if (places.length === 1) {
    return (
      <li>
        Ute {gånger(summary.eatOutCount)} på {places[0]!.name}.
      </li>
    );
  }

  const topCount = places[0]!.count;
  const leaders = places.filter((place) => place.count === topCount);
  if (topCount === 1) {
    const shown = places.slice(0, 3).map((place) => place.name);
    const extra = places.length - shown.length;
    const list = joinNames(shown);
    return (
      <li>
        Ute {gånger(summary.eatOutCount)} på {places.length}{" "}
        {places.length === 1 ? "ställe" : "ställen"}
        {extra > 0 ? `, bland annat ${list}` : `: ${list}`}.
      </li>
    );
  }
  if (leaders.length === 1 && leaders[0]!.count === summary.eatOutCount) {
    return (
      <li>
        Ute {gånger(summary.eatOutCount)} på {leaders[0]!.name}.
      </li>
    );
  }
  if (leaders.length === 1) {
    return (
      <li>
        Ute {gånger(summary.eatOutCount)}, mest på {leaders[0]!.name} (
        {gånger(leaders[0]!.count)}).
      </li>
    );
  }
  return (
    <li>
      Ute {gånger(summary.eatOutCount)}, mest på{" "}
      {joinNames(leaders.slice(0, 3).map((place) => place.name))} (
      {gånger(topCount)} var).
    </li>
  );
}

function BoxNote({ summary }: { summary: MealMonthSummaryModel }) {
  if (summary.boxesProduced === 0) return null;
  const made =
    summary.boxesProduced === 1
      ? "1 ny matlåda"
      : `${summary.boxesProduced} nya matlådor`;
  if (summary.boxesEaten === 0) return <li>{made}.</li>;
  const eaten =
    summary.boxesEaten === 1 ? "1 uppäten" : `${summary.boxesEaten} uppätna`;
  return (
    <li>
      {made} · {eaten}.
    </li>
  );
}

function SnackNote({ summary }: { summary: MealMonthSummaryModel }) {
  if (summary.snackCount === 0) return null;
  const snack =
    summary.snackCount === 1 ? "1 mellanmål" : `${summary.snackCount} mellanmål`;
  const top = summary.topSnack;
  if (!top || top.count < 2) return <li>{snack}.</li>;
  if (top.count === summary.snackCount) {
    return (
      <li>
        {snack}, alla {top.name}.
      </li>
    );
  }
  return (
    <li>
      {snack}, oftast {top.name} ({gånger(top.count)}).
    </li>
  );
}

function DrinkNote({ summary }: { summary: MealMonthSummaryModel }) {
  const drink = summary.topDrink;
  if (!drink) return null;
  return (
    <li>
      Mest druckit {drink.name}, {gånger(drink.count)}.
    </li>
  );
}

function OtherCookNote({ summary }: { summary: MealMonthSummaryModel }) {
  const notable = summary.otherCooks.filter((cook) => cook.count >= 2).slice(0, 2);
  if (notable.length === 0) return null;
  if (notable.length === 1) {
    const cook = notable[0]!;
    return (
      <li>
        Oftast någon annan: {cook.name}, {gånger(cook.count)}.
      </li>
    );
  }
  return (
    <li>
      Oftast någon annan: {listCounts(notable)}.
    </li>
  );
}

function lede(summary: MealMonthSummaryModel): string {
  const meals =
    summary.mealCount === 1 ? "1 måltid" : `${summary.mealCount} måltider`;
  if (summary.uniqueDishCount === 0) return meals;
  const dishes =
    summary.uniqueDishCount === 1
      ? "1 rätt"
      : `${summary.uniqueDishCount} olika rätter`;
  return `${meals} · ${dishes}`;
}

function gånger(count: number): string {
  return count === 1 ? "1 gång" : `${count} gånger`;
}

function formatRating(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("sv-SE", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} och ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} och ${names[names.length - 1]}`;
}

function listCounts(items: MealMonthDishStat[]): string {
  return items.map((item) => `${item.name} ${gånger(item.count)}`).join(", ");
}
