import styles from "./ActivityCategoryBadge.module.scss";

interface Props {
  icon: string;
  label: string;
  accent: string;
  done?: boolean;
  compact?: boolean;
}

export function ActivityCategoryBadge({
  icon,
  label,
  accent,
  done = false,
  compact = false,
}: Props) {
  return (
    <span
      className={[
        styles.badge,
        compact ? styles.badgeCompact : "",
        done ? styles.badgeDone : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--badge-border": `${accent}55`,
          "--badge-bg": `${accent}18`,
          "--badge-text": accent,
        } as Record<string, string>
      }
    >
      <span className={styles.icon} aria-hidden>
        {icon}
      </span>
      <span className={styles.label}>{label}</span>
    </span>
  );
}
