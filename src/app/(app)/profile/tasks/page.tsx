import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCategories,
  getMonthlyTasks,
  getWeeklyTasks,
} from "@/lib/tasks.server";
import { CategoryTasksManager } from "./CategoryTasksManager";
import { GamesManager } from "./GamesManager";
import { SportsManager } from "./SportsManager";
import { getUserGames } from "@/lib/games.server";
import { getUserSports } from "@/lib/sports.server";
import styles from "../profile.module.scss";

export const dynamic = "force-dynamic";

export default async function ProfileTasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [categories, weeklyTasks, monthlyTasks, games, sports] = await Promise.all([
    getCategories(user.id, "task"),
    getWeeklyTasks(user.id),
    getMonthlyTasks(user.id),
    getUserGames(user.id),
    getUserSports(user.id),
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/settings" className={styles.backLink}>
          ← Inställningar
        </Link>
        <p className={styles.eyebrow}>Vecka & månad</p>
        <h1 className={styles.title}>Uppgifter per kategori</h1>
        <p className={styles.muted}>
          Slå av permanenta mallar för att dölja dem i planeringen. Engångsuppgifter
          tas bort direkt i vecko- eller månadsvyn.
        </p>
      </header>

      <GamesManager games={games} />
      <SportsManager sports={sports} />

      <CategoryTasksManager
        categories={categories}
        weeklyTasks={weeklyTasks}
        monthlyTasks={monthlyTasks}
      />
    </main>
  );
}
