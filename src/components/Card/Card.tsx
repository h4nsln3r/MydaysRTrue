import type { HTMLAttributes } from "react";
import styles from "./Card.module.scss";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
}

export function Card({ accent = false, className, children, ...rest }: CardProps) {
  return (
    <div
      className={[styles.card, accent ? styles.accent : "", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
