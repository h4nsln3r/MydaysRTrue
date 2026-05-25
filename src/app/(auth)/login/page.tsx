import Link from "next/link";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.scss";

interface PageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { redirectTo } = await searchParams;

  return (
    <section className={styles.section}>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.lead}>Sign in to keep tracking your days.</p>

      <LoginForm redirectTo={redirectTo ?? "/"} />

      <p className={styles.alt}>
        New here?{" "}
        <Link href="/register" className={styles.link}>
          Create an account
        </Link>
      </p>
    </section>
  );
}
