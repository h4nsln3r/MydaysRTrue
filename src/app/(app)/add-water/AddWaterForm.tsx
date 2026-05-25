"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import { QUICK_ADDS } from "@/lib/water";
import { todayLocalISO } from "@/lib/date";
import { logWaterAction } from "../actions";
import styles from "./add-water.module.scss";

export function AddWaterForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState<string>("250");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = (ml: number, n: string) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await logWaterAction({
        amountMl: ml,
        localDate: todayLocalISO(),
        note: n,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not log.");
        return;
      }
      setSuccess(`Added ${ml} ml. Cheers.`);
      setNote("");
      router.refresh();
    });
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit(Number(amount), note);
      }}
    >
      <div className={styles.presets}>
        {QUICK_ADDS.map((q) => (
          <button
            type="button"
            key={q.ml}
            className={styles.preset}
            onClick={() => setAmount(String(q.ml))}
            aria-pressed={amount === String(q.ml)}
          >
            <span className={styles.presetIcon} aria-hidden>
              {q.icon}
            </span>
            <span>{q.ml} ml</span>
          </button>
        ))}
      </div>

      <Input
        label="Amount"
        type="number"
        min={1}
        max={5000}
        step={1}
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        suffix="ml"
        required
      />

      <Input
        label="Note (optional)"
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Morning coffee, post-run, etc."
        maxLength={120}
      />

      {error ? <p className={styles.error}>{error}</p> : null}
      {success ? <p className={styles.success}>{success}</p> : null}

      <Button type="submit" size="lg" fullWidth loading={pending}>
        Add water
      </Button>
    </form>
  );
}
