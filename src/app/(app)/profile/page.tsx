import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card/Card";
import { ProfileForm } from "./ProfileForm";
import { SignOutButton } from "./SignOutButton";
import styles from "./profile.module.scss";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, daily_water_goal_ml")
    .eq("id", user.id)
    .maybeSingle();

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
