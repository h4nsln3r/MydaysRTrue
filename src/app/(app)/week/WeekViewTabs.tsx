import Link from "next/link";
import styles from "./week.module.scss";

export type WeekView = "progress" | "plan";

interface Props {
  weekStart: string;
  view: WeekView;
}

function weekHref(weekStart: string, view: WeekView): string {
  return `/week?start=${weekStart}&view=${view}`;
}

export function WeekViewTabs({ weekStart, view }: Props) {
  return (
    <nav className={styles.viewTabs} aria-label="Veckovyer">
      <Link
        href={weekHref(weekStart, "progress")}
        className={[
          styles.viewTab,
          view === "progress" ? styles.viewTabActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-current={view === "progress" ? "page" : undefined}
      >
        Hur det går
      </Link>
      <Link
        href={weekHref(weekStart, "plan")}
        className={[
          styles.viewTab,
          view === "plan" ? styles.viewTabActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-current={view === "plan" ? "page" : undefined}
      >
        Planera
      </Link>
    </nav>
  );
}

export function weekNavHref(weekStart: string, view: WeekView): string {
  return weekHref(weekStart, view);
}
