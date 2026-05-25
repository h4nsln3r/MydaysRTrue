import styles from "./auth-layout.module.scss";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.brand}>
        <span className={styles.dot} />
        <span className={styles.wordmark}>MyDays</span>
        <span className={styles.tag}>· retro health planner</span>
      </header>
      <main className={styles.main}>{children}</main>
      <p className={styles.footer}>built for tracking your days, one habit at a time.</p>
    </div>
  );
}
