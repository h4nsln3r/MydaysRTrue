import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { createClient } from "@/lib/supabase/server";
import { getAllMealBoxStock } from "@/lib/meal-box.server";
import { MealBoxStockManager } from "./MealBoxStockManager";
import styles from "../profile.module.scss";

export const dynamic = "force-dynamic";

export default async function ProfileMealBoxesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const stock = await getAllMealBoxStock(user.id);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/settings" className={styles.backLink}>
          ← Inställningar
        </Link>
        <p className={styles.eyebrow}>Mat & kyl</p>
        <h1 className={styles.title}>Matlådor i kylen</h1>
        <p className={styles.muted}>
          Justera antal kvar när matlådor blivit gamla, eller lägg till en ny
          rätt manuellt. Sätt antal till 0 för att ta bort en rätt från lagret.
        </p>
      </header>

      <Card>
        <MealBoxStockManager stock={stock} />
      </Card>
    </main>
  );
}
