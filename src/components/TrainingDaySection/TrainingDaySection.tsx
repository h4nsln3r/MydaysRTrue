import Link from "next/link";
import { Card } from "@/components/Card/Card";
import { BathingDayCard } from "@/components/BathingDayCard/BathingDayCard";
import { CardioDayCard } from "@/components/CardioDayCard/CardioDayCard";
import { GymDayCard } from "@/components/GymDayCard/GymDayCard";
import { WeightDayCard } from "@/components/WeightDayCard/WeightDayCard";
import type { BathingSessionForWeek } from "@/lib/bathing";
import type { CardioSessionForWeek } from "@/lib/cardio";
import type { GymSessionForWeek } from "@/lib/gym";
import type { WeightDayContext } from "@/lib/weight";
import styles from "./TrainingDaySection.module.scss";

interface Props {
  weekStart: string;
  gymSessions: GymSessionForWeek[];
  cardioSessions: CardioSessionForWeek[];
  bathingSessions: BathingSessionForWeek[];
  weightContext: WeightDayContext;
  title?: string;
  gymTitle?: string;
  cardioTitle?: string;
  bathingTitle?: string;
  weightTitle?: string;
}

export function TrainingDaySection({
  weekStart,
  gymSessions,
  cardioSessions,
  bathingSessions,
  weightContext,
  title = "Träning & hälsa",
  gymTitle = "Gym",
  cardioTitle = "Cardio",
  bathingTitle = "Bad & bastu",
  weightTitle = "Vikt",
}: Props) {
  const hasGym = gymSessions.length > 0;
  const hasCardio = cardioSessions.length > 0;
  const hasBathing = bathingSessions.length > 0;
  const hasWeight = weightContext.scheduled;
  const allEmpty = !hasGym && !hasCardio && !hasBathing && !hasWeight;

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.title}>{title}</h2>
        <Link
          href={`/week?start=${weekStart}&view=plan`}
          className={styles.weekLink}
        >
          Se veckoplan →
        </Link>
      </header>

      {allEmpty ? (
        <Card className={styles.emptyCard}>
          <p className={styles.empty}>
            Inget träningspass planerat den här dagen.
          </p>
        </Card>
      ) : (
        <div className={styles.stack}>
          <GymDayCard
            weekStart={weekStart}
            sessions={gymSessions}
            title={gymTitle}
            hideWhenEmpty
            showWeekLink={false}
          />
          <CardioDayCard
            weekStart={weekStart}
            sessions={cardioSessions}
            title={cardioTitle}
            hideWhenEmpty
            showWeekLink={false}
          />
          <BathingDayCard
            weekStart={weekStart}
            sessions={bathingSessions}
            title={bathingTitle}
            hideWhenEmpty
            showWeekLink={false}
          />
          {hasWeight ? (
            <WeightDayCard context={weightContext} title={weightTitle} />
          ) : null}
        </div>
      )}
    </section>
  );
}
