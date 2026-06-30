"use client";

import { useState } from "react";
import type { RestaurantYearEntry } from "@/lib/meals.server";
import { formatDayShort } from "@/lib/date";
import styles from "./RestaurantsYearBoard.module.scss";

interface Props {
  year: number;
  restaurants: RestaurantYearEntry[];
}

export function RestaurantsYearBoard({ year, restaurants }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (restaurants.length === 0) {
    return (
      <p className={styles.empty}>
        Inga restaurangbesök loggade för {year} ännu. Välj Restaurang när du
        loggar lunch eller middag.
      </p>
    );
  }

  const totalVisits = restaurants.reduce((sum, r) => sum + r.visitCount, 0);

  return (
    <div className={styles.board}>
      <p className={styles.summary}>
        <span className={styles.summaryCount}>{restaurants.length}</span>{" "}
        {restaurants.length === 1 ? "restaurang" : "restauranger"}
        <span className={styles.summaryDot} aria-hidden>
          ·
        </span>
        <span className={styles.summaryCount}>{totalVisits}</span>{" "}
        {totalVisits === 1 ? "besök" : "besök"}
      </p>
      <p className={styles.hint}>Tryck på en restaurang för att se vad du åt.</p>

      <ul className={styles.list}>
        {restaurants.map((restaurant) => {
          const expanded = expandedId === restaurant.id;
          return (
            <li key={restaurant.id} className={styles.card}>
              <button
                type="button"
                className={[
                  styles.cardHeader,
                  expanded ? styles.cardHeaderOpen : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-expanded={expanded}
                onClick={() =>
                  setExpandedId(expanded ? null : restaurant.id)
                }
              >
                <span className={styles.headerMain}>
                  <span className={styles.name}>{restaurant.name}</span>
                  <span className={styles.count}>
                    {restaurant.visitCount}{" "}
                    {restaurant.visitCount === 1 ? "besök" : "besök"}
                  </span>
                </span>
                <span
                  className={[styles.chevron, expanded ? styles.chevronUp : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden
                >
                  ›
                </span>
              </button>

              {expanded ? (
                <ul className={styles.visits}>
                  {restaurant.visits.map((visit) => (
                    <li
                      key={`${visit.date}-${visit.meal}`}
                      className={styles.visit}
                    >
                      <span className={styles.visitMeta}>
                        {formatDayShort(visit.date)} · {visit.mealLabel}
                      </span>
                      <span className={styles.visitFood}>{visit.description}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
