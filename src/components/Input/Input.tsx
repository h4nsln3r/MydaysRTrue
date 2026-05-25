import { forwardRef, type InputHTMLAttributes, useId } from "react";
import styles from "./Input.module.scss";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, suffix, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className={[styles.field, error ? styles.hasError : "", className ?? ""].filter(Boolean).join(" ")}>
      {label ? (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div className={styles.inputWrap}>
        <input ref={ref} id={inputId} className={styles.input} {...rest} />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </div>
      {error ? <p className={styles.error}>{error}</p> : hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  );
});
