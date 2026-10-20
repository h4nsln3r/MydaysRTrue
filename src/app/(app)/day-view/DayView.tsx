import { Suspense } from "react";
import { DayNav } from "@/components/DayNav/DayNav";
import type { PeriodView } from "@/lib/period-view";
import styles from "../dashboard.module.scss";
import { DayPlanSettingsSection } from "./DayPlanSettingsSection";
import { DayProgress } from "./DayProgress";
import { SideColumnSkeleton } from "./DayProgressFallback";
import { TripHeading } from "./TripHeading";

interface Props {
  date: string;
  today: string;
  view: PeriodView;
  upcoming?: boolean;
  showWaterLog?: boolean;
  waterPlusHref: string;
  waterPlusLabel: string;
}

export function DayView({
  date,
  today,
  view,
  upcoming = false,
  showWaterLog = false,
  waterPlusHref,
  waterPlusLabel,
}: Props) {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <Suspense fallback={null}>
            <TripHeading date={date} />
          </Suspense>
          <DayNav date={date} today={today} view={view} />
        </div>
      </header>

      {view === "progress" ? (
        <DayProgress
          date={date}
          today={today}
          upcoming={upcoming}
          showWaterLog={showWaterLog}
          waterPlusHref={waterPlusHref}
          waterPlusLabel={waterPlusLabel}
        />
      ) : (
        <Suspense
          fallback={
            <div aria-busy="true" aria-label="Laddar plan">
              <SideColumnSkeleton />
            </div>
          }
        >
          <DayPlanSettingsSection />
        </Suspense>
      )}
    </main>
  );
}
