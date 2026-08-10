"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { MealRestaurant } from "@/lib/habits";
import styles from "./RestaurantCombobox.module.scss";

interface Props {
  value: string;
  selectedId: string | null;
  restaurants: MealRestaurant[];
  disabled?: boolean;
  onChange: (next: { restaurantName: string; restaurantId: string | null }) => void;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function RestaurantCombobox({
  value,
  selectedId,
  restaurants,
  disabled = false,
  onChange,
}: Props) {
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const query = normalize(value);

  const filtered = useMemo(() => {
    if (!query) return restaurants;
    return restaurants.filter((r) => normalize(r.name).includes(query));
  }, [restaurants, query]);

  const exactMatch = useMemo(
    () => restaurants.find((r) => normalize(r.name) === query) ?? null,
    [restaurants, query],
  );

  const showCreate =
    query.length > 0 && !exactMatch && restaurants.length > 0;

  const options = useMemo(() => {
    const items: Array<
      | { kind: "restaurant"; restaurant: MealRestaurant }
      | { kind: "create"; name: string }
    > = filtered.map((restaurant) => ({
      kind: "restaurant" as const,
      restaurant,
    }));
    if (showCreate) {
      items.push({ kind: "create", name: value.trim() });
    }
    return items;
  }, [filtered, showCreate, value]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const selectRestaurant = (restaurant: MealRestaurant) => {
    onChange({
      restaurantName: restaurant.name,
      restaurantId: restaurant.id,
    });
    setOpen(false);
  };

  const selectCreate = (name: string) => {
    onChange({
      restaurantName: name,
      restaurantId: null,
    });
    setOpen(false);
  };

  const commitActive = () => {
    const option = options[activeIndex];
    if (!option) {
      if (exactMatch) {
        selectRestaurant(exactMatch);
      } else {
        setOpen(false);
      }
      return;
    }
    if (option.kind === "restaurant") {
      selectRestaurant(option.restaurant);
    } else {
      selectCreate(option.name);
    }
  };

  const onInputChange = (nextValue: string) => {
    const match = restaurants.find(
      (r) => normalize(r.name) === normalize(nextValue),
    );
    onChange({
      restaurantName: nextValue,
      restaurantId: match?.id ?? null,
    });
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) => (options.length === 0 ? 0 : (i + 1) % options.length));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((i) =>
        options.length === 0
          ? 0
          : (i - 1 + options.length) % options.length,
      );
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      commitActive();
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  const hint =
    restaurants.length > 0
      ? "Sök bland sparade eller skriv ett nytt namn"
      : "Skriv namnet på restaurangen";

  return (
    <div className={styles.root} ref={rootRef}>
      <label htmlFor={inputId} className={styles.label}>
        Restaurang
      </label>
      <div
        className={[
          styles.inputWrap,
          open ? styles.inputWrapOpen : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          ref={inputRef}
          id={inputId}
          className={styles.input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && options[activeIndex]
              ? `${listboxId}-option-${activeIndex}`
              : undefined
          }
          value={value}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Sök eller skriv nytt…"
          maxLength={120}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className={styles.chevron}
          aria-label={open ? "Stäng lista" : "Visa lista"}
          aria-expanded={open}
          tabIndex={-1}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              setOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4 6l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open && !disabled ? (
        <ul
          id={listboxId}
          className={styles.listbox}
          role="listbox"
          aria-label="Restauranger"
        >
          {options.length === 0 ? (
            <li className={styles.empty}>
              {query
                ? `Ingen träff — tryck Enter för att använda “${value.trim()}”`
                : "Inga sparade restauranger än"}
            </li>
          ) : (
            options.map((option, index) => {
              if (option.kind === "create") {
                return (
                  <li key="create" role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      className={`${styles.option} ${styles.optionCreate}`}
                      aria-selected={false}
                      data-active={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectCreate(option.name)}
                    >
                      <span>
                        <span className={styles.createLabel}>Lägg till </span>
                        <span className={styles.createName}>
                          “{option.name}”
                        </span>
                      </span>
                    </button>
                  </li>
                );
              }

              const selected = option.restaurant.id === selectedId;
              return (
                <li key={option.restaurant.id} role="presentation">
                  <button
                    type="button"
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    className={styles.option}
                    aria-selected={selected}
                    data-active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectRestaurant(option.restaurant)}
                  >
                    {option.restaurant.name}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      <p className={styles.hint}>{hint}</p>
    </div>
  );
}
