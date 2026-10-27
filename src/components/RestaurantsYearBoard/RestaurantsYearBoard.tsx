"use client";

import { useState } from "react";
import type { RestaurantYearEntry } from "@/lib/meals.server";
import { formatDayShort } from "@/lib/date";
import styles from "./RestaurantsYearBoard.module.scss";

const TOP_COUNT = 5;

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
  const mostVisited = [...restaurants]
    .sort(
      (a, b) =>
        b.visitCount - a.visitCount || a.name.localeCompare(b.name, "sv"),
    )
    .slice(0, TOP_COUNT);
  const highestRated = restaurants
    .filter((restaurant) => restaurant.averageRating != null)
    .sort(
      (a, b) =>
        b.averageRating! - a.averageRating! ||
        b.ratingCount - a.ratingCount ||
        a.name.localeCompare(b.name, "sv"),
    )
    .slice(0, TOP_COUNT);

  function openRestaurant(id: string) {
    setExpandedId(id);
    document.getElementById(restaurantDomId(id))?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

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

      <div className={styles.ranks}>
        <RankList
          title="Mest besökta"
          rows={mostVisited.map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            value: String(restaurant.visitCount),
            hint: "besök",
          }))}
          onOpen={openRestaurant}
        />
        <RankList
          title="Högst betyg"
          rows={highestRated.map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            value: formatRating(restaurant.averageRating!),
            hint:
              restaurant.ratingCount === 1
                ? "1 betyg"
                : `${restaurant.ratingCount} betyg`,
          }))}
          empty="Inga betyg ännu."
          onOpen={openRestaurant}
        />
      </div>

      <p className={styles.hint}>Tryck på en restaurang för att se vad du åt.</p>

      <ul className={styles.list}>
        {restaurants.map((restaurant) => {
          const expanded = expandedId === restaurant.id;
          return (
            <li
              key={restaurant.id}
              id={restaurantDomId(restaurant.id)}
              className={styles.card}
            >
              <button
                type="button"
                className={[
                  styles.cardHeader,
                  expanded ? styles.cardHeaderOpen : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : restaurant.id)}
              >
                <span className={styles.headerMain}>
                  <span className={styles.name}>{restaurant.name}</span>
                  <span className={styles.count}>
                    {restaurant.visitCount}{" "}
                    {restaurant.visitCount === 1 ? "besök" : "besök"}
                    {restaurant.averageRating != null
                      ? ` · ${formatRating(restaurant.averageRating)}`
                      : ""}
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
                        {visit.rating != null ? ` · ${visit.rating}/10` : ""}
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

function RankList({
  title,
  rows,
  empty,
  onOpen,
}: {
  title: string;
  rows: { id: string; name: string; value: string; hint: string }[];
  empty?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <section className={styles.rankCard} aria-label={title}>
      <h3 className={styles.rankTitle}>{title}</h3>
      {rows.length === 0 ? (
        <p className={styles.rankEmpty}>{empty}</p>
      ) : (
        <ol className={styles.rankList}>
          {rows.map((row, index) => (
            <li key={row.id}>
              <button
                type="button"
                className={styles.rankButton}
                onClick={() => onOpen(row.id)}
              >
                <span className={styles.rankIndex}>{index + 1}</span>
                <span className={styles.rankName}>{row.name}</span>
                <span className={styles.rankValue}>
                  <span>{row.value}</span>
                  <span className={styles.rankHint}>{row.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function restaurantDomId(id: string): string {
  return `restaurant-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function formatRating(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("sv-SE", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  });
}
