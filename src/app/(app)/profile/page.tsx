import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { getHabits } from "@/lib/habits.server";
import { ProfileForm } from "./ProfileForm";
import { SignOutButton } from "./SignOutButton";
import { HabitsManager } from "./HabitsManager";
import styles from "./profile.module.scss";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, habits] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, daily_water_goal_ml")
      .eq("id", user.id)
      .maybeSingle(),
    getHabits(user.id),
  ]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Profile</p>
        <h1 className={styles.title}>
          {profile?.display_name || user.email?.split("@")[0] || "You"}
        </h1>
        <p className={styles.email}>{user.email}</p>
      </header>

      <Card accent>
        <ProfileForm
          initialDisplayName={profile?.display_name ?? ""}
          initialDailyGoalMl={profile?.daily_water_goal_ml ?? 2500}
        />
      </Card>

      <Card>
        <header className={styles.signoutWrap} style={{ marginBottom: 16 }}>
          <div>
            <h3 className={styles.h3}>Daily habits</h3>
            <p className={styles.muted}>What you check off each day.</p>
          </div>
        </header>
        <HabitsManager habits={habits} />
      </Card>

      <Card>
        <div className={styles.signoutWrap}>
          <div>
            <h3 className={styles.h3}>Sign out</h3>
            <p className={styles.muted}>End your session on this device.</p>
          </div>
          <SignOutButton />
        </div>
      </Card>
    </main>
  );
}
