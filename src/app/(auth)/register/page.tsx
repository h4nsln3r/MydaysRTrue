import Link from "next/link";
import { RegisterForm } from "./RegisterForm";
import styles from "../login/login.module.scss";

export default function RegisterPage() {
  return (
    <section className={styles.section}>
      <h1 className={styles.title}>Start tracking</h1>
      <p className={styles.lead}>Create an account — takes 10 seconds.</p>

      <RegisterForm />

      <p className={styles.alt}>
        Already on board?{" "}
        <Link href="/login" className={styles.link}>
          Sign in
        </Link>
      </p>
    </section>
  );
}
