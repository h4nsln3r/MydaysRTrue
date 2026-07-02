import { ActivityCategoryBadge } from "@/components/ActivityCategoryBadge/ActivityCategoryBadge";
import styles from "./PlanCadenceBadge.module.scss";

export type PlanCadence = "daily" | "weekly" | "monthly";

const CADENCE_META: Record<
  PlanCadence,
  { icon: string; label: string; accent: string }
> = {
  daily: { icon: "☀️", label: "Dag", accent: "#5fb6ff" },
  weekly: { icon: "📋", label: "Vecka", accent: "#6ee7a3" },
  monthly: { icon: "📅", label: "Månad", accent: "#f59e0b" },
};

interface Props {
  cadence: PlanCadence;
  done?: boolean;
  /** Pin a compact badge in the task card's top-left corner. */
  corner?: boolean;
}

export function PlanCadenceBadge({ cadence, done = false, corner = false }: Props) {
  const meta = CADENCE_META[cadence];
  const badge = (
    <ActivityCategoryBadge
      icon={meta.icon}
      label={meta.label}
      accent={meta.accent}
      done={done}
      compact={corner}
    />
  );

  if (!corner) return badge;

  return <span className={styles.corner}>{badge}</span>;
}
