import { Suspense } from "react";
import styles from "../dashboard.module.scss";
import { DayActivitiesSection } from "./DayActivitiesSection";
import { DayJournalBlock } from "./DayJournalBlock";
import { DayTrackersSection } from "./DayTrackersSection";
import { DayWaterSection } from "./DayWaterSection";
import { PlanShownProvider } from "./FadeIn";
import { JournalSkeleton, PlanListSkeleton, TrackersSkeleton, WaterLogSkeleton } from "./DayProgressFallback";

interface Props {
  date: string;
  today: string;
  upcoming?: boolean;
  showWaterLog?: boolean;
  waterPlusHref: string;
  waterPlusLabel: string;
}

/**
 * The plan list is fetched before the other sections. Each block shows a
 * skeleton shaped like the card that will replace it.
 */
export function DayProgress({
  date,
  today,
  upcoming = false,
  showWaterLog = false,
  waterPlusHref,
  waterPlusLabel,
}: Props) {
  return (
    <PlanShownProvider>
      <div className={upcoming ? undefined : styles.dashboard}>
        <section className={styles.section}>
          <Suspense fallback={<PlanListSkeleton />}>
            <DayActivitiesSection date={date} today={today} upcoming={upcoming} />
          </Suspense>
        </section>

        {upcoming ? null : (
          <section className={styles.section}>
            <Suspense fallback={<TrackersSkeleton />}>
              <DayTrackersSection
                date={date}
                waterPlusHref={waterPlusHref}
                waterPlusLabel={waterPlusLabel}
              />
            </Suspense>
          </section>
        )}
      </div>

      {upcoming ? null : (
        <Suspense
          fallback={
            <section className={styles.section}>
              <JournalSkeleton />
            </section>
          }
        >
          <DayJournalBlock date={date} />
        </Suspense>
      )}

      {showWaterLog && !upcoming ? (
        <Suspense
          fallback={
            <section className={styles.section}>
              <WaterLogSkeleton />
            </section>
          }
        >
          <DayWaterSection date={date} />
        </Suspense>
      ) : null}
    </PlanShownProvider>
  );
}
