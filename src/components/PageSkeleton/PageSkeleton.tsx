import styles from "./PageSkeleton.module.scss";

export function PageSkeleton() {
  return (
    <main className={styles.main} aria-busy="true" aria-label="Laddar…">
      <header className={styles.header}>
        <div className={[styles.kicker, styles.bone].join(" ")} />
        <div className={styles.titleRow}>
          <div className={[styles.title, styles.bone].join(" ")} />
        </div>
      </header>

      <div className={styles.tabs}>
        <div className={[styles.tab, styles.bone].join(" ")} />
        <div className={[styles.tab, styles.bone].join(" ")} />
      </div>

      <div className={styles.cards}>
        <div className={[styles.card, styles.bone].join(" ")} />
        <div className={[styles.card, styles.bone].join(" ")} />
        <div className={[styles.cardTall, styles.bone].join(" ")} />
      </div>
    </main>
  );
}
