"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDayShort } from "@/lib/date";
import { updateWeeklyTaskCompletionAction } from "@/app/(app)/tasks-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { SpendKindFields } from "@/components/SpendKindFields/SpendKindFields";
import {
  formatExpenseKr,
  mergeExpenseSummaries,
  SPEND_KIND_TOTAL_LABEL,
  SPEND_KIND_TOTAL_ORDER,
  type ExpenseEntry,
  type ExpenseSummary,
  type SpendKindTotalKey,
} from "@/lib/expenses";
import {
  allowedSpendKinds,
  SPEND_KIND_ICON,
  SPEND_KIND_LABEL,
  type SpendKind,
} from "@/lib/tasks";
import styles from "./ExpensesSummary.module.scss";

interface Props {
  summary: ExpenseSummary;
  title: string;
  icon?: string;
  variant?: "expense" | "shopping";
  emptyMessage?: string;
}

function KindTotals({
  totalsByKind,
}: {
  totalsByKind: ExpenseSummary["totalsByKind"];
}) {
  const keys = SPEND_KIND_TOTAL_ORDER.filter((key) => totalsByKind[key] > 0);
  if (keys.length === 0) return null;
  const sharedHalf = totalsByKind.shared / 2;

  return (
    <ul className={styles.split} aria-label="Fördelning">
      {keys.map((key) => (
        <li key={key} className={styles.splitItem}>
          <span className={styles.splitLabel}>
            {kindIcon(key)} {SPEND_KIND_TOTAL_LABEL[key]}
          </span>
          <span className={styles.splitAmount}>
            {formatExpenseKr(totalsByKind[key])}
          </span>
          {key === "shared" ? (
            <span className={styles.splitHint}>
              Hälften {formatExpenseKr(sharedHalf)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function kindIcon(key: SpendKindTotalKey): string {
  if (key === "unset") return "❔";
  return SPEND_KIND_ICON[key];
}

export function SpendSplitOverview({
  shopping,
  expenses,
  title,
}: {
  shopping: ExpenseSummary;
  expenses: ExpenseSummary;
  title: string;
}) {
  const combined = mergeExpenseSummaries(shopping, expenses);
  if (combined.entries.length === 0) return null;

  return (
    <section className={[styles.panel, styles.panelSplit].join(" ")} aria-label={title}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            📊
          </span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <p className={styles.total}>{formatExpenseKr(combined.totalKr)}</p>
      </header>
      <KindTotals totalsByKind={combined.totalsByKind} />
    </section>
  );
}

export function ExpensesSummary({
  summary,
  title,
  icon = "💸",
  variant = "expense",
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (summary.entries.length === 0) return null;

  return (
    <section
      className={[
        styles.panel,
        variant === "shopping" ? styles.panelShopping : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={title}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden>
            {icon}
          </span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <p
          className={[
            styles.total,
            variant === "shopping" ? styles.totalShopping : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {formatExpenseKr(summary.totalKr)}
        </p>
      </header>

      <KindTotals totalsByKind={summary.totalsByKind} />

      <ul className={styles.list}>
        {summary.entries.map((entry) => (
          <ExpenseRow
            key={entry.id}
            entry={entry}
            editing={editingId === entry.id}
            onToggleEdit={() =>
              setEditingId((id) => (id === entry.id ? null : entry.id))
            }
            onCloseEdit={() => setEditingId(null)}
          />
        ))}
      </ul>
    </section>
  );
}

function ExpenseRow({
  entry,
  editing,
  onToggleEdit,
  onCloseEdit,
}: {
  entry: ExpenseEntry;
  editing: boolean;
  onToggleEdit: () => void;
  onCloseEdit: () => void;
}) {
  if (editing && entry.editable) {
    return (
      <ExpenseEditRow
        entry={entry}
        onToggleEdit={onToggleEdit}
        onCloseEdit={onCloseEdit}
      />
    );
  }

  return (
    <li className={styles.row}>
      <span
        className={styles.rowIcon}
        aria-hidden
        style={{ borderColor: entry.accent }}
      >
        {entry.icon}
      </span>
      <div className={styles.rowBody}>
        <span className={styles.rowTitle}>
          {entry.title}
          {entry.spendKind ? (
            <span className={styles.kindBadge}>
              {SPEND_KIND_ICON[entry.spendKind]} {SPEND_KIND_LABEL[entry.spendKind]}
            </span>
          ) : null}
        </span>
        <span className={styles.rowDetail}>
          {entry.description}
          {entry.amountExpr ? ` · ${entry.amountExpr}` : ""}
          {entry.note?.trim() && entry.note.trim() !== entry.description
            ? ` · ${entry.note.trim()}`
            : ""}
        </span>
        <span className={styles.rowMeta}>
          {formatDayShort(entry.localDate)}
          {entry.scope === "monthly" ? " · månad" : " · vecka"}
        </span>
      </div>
      <span className={styles.rowEnd}>
        <span className={styles.rowAmount}>{formatExpenseKr(entry.amountKr)}</span>
        {entry.editable ? (
          <button
            type="button"
            className={styles.gearBtn}
            aria-label="Redigera"
            title="Redigera"
            onClick={onToggleEdit}
          >
            <GearIcon />
          </button>
        ) : null}
      </span>
    </li>
  );
}

function ExpenseEditRow({
  entry,
  onToggleEdit,
  onCloseEdit,
}: {
  entry: ExpenseEntry;
  onToggleEdit: () => void;
  onCloseEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [spendKind, setSpendKind] = useState<SpendKind | null>(entry.spendKind);
  const [shopLocation, setShopLocation] = useState(entry.shopLocation ?? "");
  const [shopAmount, setShopAmount] = useState(entry.shopAmountExpr);
  const [note, setNote] = useState(entry.note ?? "");

  useEffect(() => {
    setSpendKind(entry.spendKind);
    setShopLocation(entry.shopLocation ?? "");
    setShopAmount(entry.shopAmountExpr);
    setNote(entry.note ?? "");
    setError(null);
  }, [entry]);

  const dirty =
    spendKind !== entry.spendKind ||
    shopLocation !== (entry.shopLocation ?? "") ||
    shopAmount !== entry.shopAmountExpr ||
    note !== (entry.note ?? "");

  const save = () => {
    if (!entry.taskId || !entry.weekStart || !entry.placementId) return;
    setError(null);
    startTransition(async () => {
      const res = await updateWeeklyTaskCompletionAction({
        taskId: entry.taskId!,
        weekStart: entry.weekStart!,
        placementId: entry.placementId!,
        shopLocation,
        shopAmountExpr: shopAmount,
        spendKind,
        note,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte spara.");
        return;
      }
      onCloseEdit();
      router.refresh();
    });
  };

  const kinds =
    entry.completionKind === "shop" || entry.completionKind === "expense"
      ? allowedSpendKinds(entry.completionKind)
      : [];

  return (
    <li className={[styles.row, styles.rowEditing].join(" ")}>
      <div className={styles.editHead}>
        <span
          className={styles.rowIcon}
          aria-hidden
          style={{ borderColor: entry.accent }}
        >
          {entry.icon}
        </span>
        <div className={styles.rowBody}>
          <span className={styles.rowTitle}>{entry.title}</span>
          <span className={styles.rowMeta}>
            {formatDayShort(entry.localDate)}
            {entry.scope === "monthly" ? " · månad" : " · vecka"}
          </span>
        </div>
        <button
          type="button"
          className={[styles.gearBtn, styles.gearBtnActive].join(" ")}
          aria-label="Stäng redigering"
          title="Stäng"
          onClick={onToggleEdit}
          disabled={pending}
        >
          <GearIcon />
        </button>
      </div>
      <SpendKindFields
        kinds={kinds}
        value={spendKind}
        onChange={setSpendKind}
        disabled={pending}
        label={
          entry.completionKind === "expense"
            ? "Privat eller delat?"
            : "Mat, privat eller delat?"
        }
      />
      <Input
        label={
          entry.completionKind === "expense"
            ? "Vad gällde utgiften?"
            : "Var handlade du?"
        }
        value={shopLocation}
        onChange={(e) => setShopLocation(e.target.value)}
        maxLength={120}
        disabled={pending}
      />
      <Input
        label="Summa (kr)"
        inputMode="decimal"
        value={shopAmount}
        onChange={(e) => setShopAmount(e.target.value)}
        placeholder="t.ex. 450 eller 45+120"
        disabled={pending}
      />
      <Input
        label="Kommentar (valfritt)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        disabled={pending}
      />
      {error ? <p className={styles.editError}>{error}</p> : null}
      <Button
        type="button"
        variant="outline"
        size="md"
        disabled={pending || !dirty || spendKind == null || !shopLocation.trim()}
        loading={pending}
        onClick={save}
      >
        Spara
      </Button>
    </li>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 13.5a7.7 7.7 0 0 0 .06-1.5 7.7 7.7 0 0 0-.06-1.5l2.04-1.59-2-3.46-2.45.98a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.43 2.93a7.6 7.6 0 0 0-2.6 1.5l-2.45-.98-2 3.46L4.56 10.5A7.7 7.7 0 0 0 4.5 12c0 .5.02 1 .06 1.5L2.52 15.09l2 3.46 2.45-.98a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.43-2.93a7.6 7.6 0 0 0 2.6-1.5l2.45.98 2-3.46L19.4 13.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
