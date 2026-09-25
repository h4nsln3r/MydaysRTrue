import Link from "next/link";
import type { PeriodView } from "@/lib/period-view";
import styles from "./ProgressPlanTabs.module.scss";

interface Props {
  view: PeriodView;
  progressHref: string;
  planHref: string;
}

export function ProgressPlanTabs({ view, progressHref, planHref }: Props) {
  return (
    <nav className={styles.tabs} aria-label="Vy">
      <Link
        href={progressHref}
        className={[
          styles.tab,
          view === "progress" ? styles.tabActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-current={view === "progress" ? "page" : undefined}
      >
        Todo
      </Link>
      <Link
        href={planHref}
        className={[
          styles.tab,
          view === "plan" ? styles.tabActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-current={view === "plan" ? "page" : undefined}
      >
        Plan
      </Link>
    </nav>
  );
}
