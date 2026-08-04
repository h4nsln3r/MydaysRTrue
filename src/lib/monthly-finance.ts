export const EDITABLE_FINANCE_KEYS = [
  "kort",
  "spar",
  "isk",
  "sbab_spar",
  "avanza",
  "krypto",
  "cash",
] as const;

export type EditableFinanceKey = (typeof EDITABLE_FINANCE_KEYS)[number];

export type MonthlyFinanceBalances = Record<EditableFinanceKey, number | null>;

export interface FinanceTableRow {
  kind: "lf-total" | "account" | "grand-total";
  key?: EditableFinanceKey;
  label: string;
  indent?: boolean;
  hint?: string;
}

/** Display order for the monthly accounts table. */
export const FINANCE_TABLE_ROWS: FinanceTableRow[] = [
  {
    kind: "lf-total",
    label: "Länsförsäkringar (totalt)",
    hint: "Kort + Spar + ISK på LF",
  },
  {
    kind: "account",
    key: "kort",
    label: "Kort på LF",
    indent: true,
  },
  {
    kind: "account",
    key: "spar",
    label: "Spar på LF",
    indent: true,
  },
  {
    kind: "account",
    key: "isk",
    label: "ISK fondkonto på LF",
    indent: true,
    hint: "Uppdateras vid överföring fondkonto LF",
  },
  {
    kind: "account",
    key: "sbab_spar",
    label: "SBAB spar",
    hint: "Uppdateras vid överföring SBAB spar",
  },
  {
    kind: "account",
    key: "avanza",
    label: "Avanza",
    hint: "Uppdateras vid överföring Avanza",
  },
  {
    kind: "account",
    key: "krypto",
    label: "Krypto",
  },
  {
    kind: "account",
    key: "cash",
    label: "Cash (uttaget)",
  },
  {
    kind: "grand-total",
    label: "Totalt",
  },
];

/** Canonical titles, notes and account targets for savings transfer tasks. */
export const SAVINGS_TRANSFER_TASKS = {
  save_transfer_lf: {
    title: "Överföring fondkonto LF",
    notes: "Ange belopp som fördes över till ISK fondkonto på LF.",
    account: "isk" as EditableFinanceKey,
  },
  save_transfer_avanza: {
    title: "Överföring Avanza",
    notes: "Ange belopp som fördes över till Avanza.",
    account: "avanza" as EditableFinanceKey,
  },
  save_transfer_spar: {
    title: "Överföring SBAB spar",
    notes: "Ange belopp som fördes över till SBAB spar.",
    account: "sbab_spar" as EditableFinanceKey,
  },
} as const;

export type SavingsTransferTaskKey = keyof typeof SAVINGS_TRANSFER_TASKS;

/** Maps savings transfer tasks → finance account column. */
export const TRANSFER_TASK_ACCOUNT: Record<string, EditableFinanceKey> =
  Object.fromEntries(
    Object.entries(SAVINGS_TRANSFER_TASKS).map(([key, meta]) => [
      key,
      meta.account,
    ]),
  );

export const SALARY_TASK_KEY = "finance_lon";
export const CARPAY_TASK_KEY = "finance_carpay";
export const FINANCE_EKONOMI_TASK_KEY = "finance_ekonomi";

/** Month plan URL that scrolls to the ekonomi accounts table. */
export function monthPlanEkonomiHref(monthStart: string): string {
  return `/month?m=${monthStart.slice(0, 7)}&view=plan#ekonomi`;
}

export function isSavingsTransferTaskKey(
  key: string | null | undefined,
): key is SavingsTransferTaskKey {
  return key != null && key in SAVINGS_TRANSFER_TASKS;
}

export function monthlyTaskDisplayTitle(task: {
  key: string | null;
  title: string;
}): string {
  if (isSavingsTransferTaskKey(task.key)) {
    return SAVINGS_TRANSFER_TASKS[task.key].title;
  }
  return task.title;
}

/** Finance table label for where a transfer task posts its amount. */
export function transferTaskFinanceLabel(
  taskKey: string | null | undefined,
): string | null {
  if (!isSavingsTransferTaskKey(taskKey)) return null;
  const account = SAVINGS_TRANSFER_TASKS[taskKey].account;
  return (
    FINANCE_TABLE_ROWS.find((row) => row.key === account)?.label ?? null
  );
}

export interface MonthlyFinanceSnapshot {
  monthStart: string;
  balances: MonthlyFinanceBalances;
  note: string | null;
  doneAt: string | null;
}

export const EMPTY_FINANCE_BALANCES: MonthlyFinanceBalances = {
  kort: null,
  spar: null,
  isk: null,
  sbab_spar: null,
  avanza: null,
  krypto: null,
  cash: null,
};

export function lfTotal(balances: MonthlyFinanceBalances): number {
  return (["kort", "spar", "isk"] as const).reduce((sum, key) => {
    const v = balances[key];
    return sum + (v != null && Number.isFinite(v) ? v : 0);
  }, 0);
}

export function financeTotal(balances: MonthlyFinanceBalances): number {
  return EDITABLE_FINANCE_KEYS.reduce((sum, key) => {
    const v = balances[key];
    return sum + (v != null && Number.isFinite(v) ? v : 0);
  }, 0);
}

export function formatKr(amount: number): string {
  return `${Math.round(amount).toLocaleString("sv-SE")} kr`;
}

export function parseKrInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** True when the saved sum text is more than a single number (e.g. "45+120"). */
export function shopAmountExprHasBreakdown(expr: string | null | undefined): boolean {
  if (!expr) return false;
  const compact = expr.replace(/\s/g, "");
  return /[+\-]/.test(compact.slice(1));
}

/**
 * Parse a kr sum that may be a single amount or an expression like "45+120+8,50".
 * Supports + and -; commas or dots as decimals; spaces around operators.
 * Returns the user-facing expression (trimmed) and computed total.
 */
export function parseShopAmountExpr(
  raw: string,
): { total: number; expression: string } | null {
  const expression = raw.trim();
  if (!expression) return null;

  const single = parseKrInput(expression);
  if (single != null && !shopAmountExprHasBreakdown(expression)) {
    if (single < 0) return null;
    return { total: single, expression };
  }

  const compact = expression.replace(/\s+/g, "").replace(/(\d),(\d)/g, "$1.$2");
  if (!/^-?\d+(\.\d+)?([+\-]\d+(\.\d+)?)*$/.test(compact)) {
    return null;
  }

  const terms = compact.match(/[+\-]?\d+(?:\.\d+)?/g);
  if (!terms || terms.length === 0) return null;

  let total = 0;
  for (const term of terms) {
    total += Number(term);
  }
  if (!Number.isFinite(total) || total < 0) return null;

  return {
    total: Math.round(total * 100) / 100,
    expression,
  };
}

export function balancesFromSnapshotRow(row: {
  kort: number | null;
  spar: number | null;
  isk: number | null;
  sbab_spar: number | null;
  avanza: number | null;
  krypto: number | null;
  cash: number | null;
}): MonthlyFinanceBalances {
  const balances = { ...EMPTY_FINANCE_BALANCES };
  for (const key of EDITABLE_FINANCE_KEYS) {
    const v = row[key];
    balances[key] = v != null ? Number(v) : null;
  }
  return balances;
}

export function applyTransferDelta(
  balances: MonthlyFinanceBalances,
  account: EditableFinanceKey,
  delta: number,
): MonthlyFinanceBalances {
  const current = balances[account] ?? 0;
  return {
    ...balances,
    [account]: Math.round((current + delta) * 100) / 100,
  };
}
