import type { CodingProject } from "@/lib/coding";
import type { DayQuickAddSources } from "@/lib/day-quick-add";
import type { UserGame } from "@/lib/games";
import type { MealBoxStockItem, MealRestaurant } from "@/lib/habits";
import type { UserSport } from "@/lib/sports";

/** Data the day list can render without. Used by the plus menu and expanded rows. */
export interface PlanListExtras {
  codingProjects: CodingProject[];
  games: UserGame[];
  sports: UserSport[];
  quickAddSources: DayQuickAddSources;
  savedRestaurants: MealRestaurant[];
  mealBoxStock: MealBoxStockItem[];
}

export const EMPTY_PLAN_EXTRAS: PlanListExtras = {
  codingProjects: [],
  games: [],
  sports: [],
  quickAddSources: {
    gym: [],
    cardioTemplateId: null,
    sportTemplateId: null,
    baths: [],
    shake: null,
  },
  savedRestaurants: [],
  mealBoxStock: [],
};
