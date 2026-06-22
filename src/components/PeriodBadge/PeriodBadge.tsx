import {
  formatNavDayBadge,
  formatNavMonthBadge,
  formatNavWeekBadge,
  formatNavYearBadge,
  todayLocalISO,
} from "@/lib/date";
import styles from "./PeriodBadge.module.scss";

export type PeriodBadgeKind = "day" | "week" | "month" | "year";

const FORMATTERS: Record<
  PeriodBadgeKind,
  (localDate: string) => string
> = {
  day: formatNavDayBadge,
  week: formatNavWeekBadge,
  month: formatNavMonthBadge,
  year: formatNavYearBadge,
};

interface Props {
  kind: PeriodBadgeKind;
  /** Defaults to today. Pass a YYYY-MM-DD for day-specific badges. */
  date?: string;
  variant?: "nav" | "header";
  className?: string;
}

export function PeriodBadge({
  kind,
  date,
  variant = "header",
  className,
}: Props) {
  const text = FORMATTERS[kind](date ?? todayLocalISO());
  return (
    <span
      className={[styles.badge, styles[variant], className]
        .filter(Boolean)
        .join(" ")}
    >
      {text}
    </span>
  );
}

interface TitleProps {
  kind: PeriodBadgeKind;
  children: React.ReactNode;
  date?: string;
  stacked?: boolean;
}

/** Page nav title with the matching period badge beside it. */
export function PeriodNavTitle({
  kind,
  children,
  date,
  stacked = false,
}: TitleProps) {
  return (
    <span
      className={[
        styles.titleWrap,
        stacked ? styles.titleWrapStacked : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
      <PeriodBadge kind={kind} date={date} variant="header" />
    </span>
  );
}
