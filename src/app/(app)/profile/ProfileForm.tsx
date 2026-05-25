"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import { updateProfileAction, type ProfileFormState } from "./actions";
import styles from "./profile.module.scss";

const initialState: ProfileFormState = {};
const PRESETS = [1500, 2000, 2500, 3000, 3500];

interface Props {
  initialDisplayName: string;
  initialDailyGoalMl: number;
}

export function ProfileForm({ initialDisplayName, initialDailyGoalMl }: Props) {
  const [state, action] = useActionState(updateProfileAction, initialState);
  const [goal, setGoal] = useState<number>(initialDailyGoalMl);

  return (
    <form action={action} className={styles.form}>
      <Input
        label="Display name"
        name="displayName"
        type="text"
        defaultValue={initialDisplayName}
        placeholder="What should we call you?"
      />

      <div className={styles.goalBlock}>
        <label className={styles.label}>Daily water goal</label>
        <div className={styles.goalRow}>
          <Input
            name="dailyWaterGoalMl"
            type="number"
            min={250}
            max={20000}
            step={50}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value || 0))}
            suffix="ml / day"
            inputMode="numeric"
            required
          />
          <span className={styles.literage}>
            ≈ <strong>{(goal / 1000).toFixed(goal % 1000 === 0 ? 0 : 2)} L</strong>
          </span>
        </div>

        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={styles.preset}
              aria-pressed={goal === p}
              onClick={() => setGoal(p)}
            >
              {p} ml
            </button>
          ))}
        </div>

        <p className={styles.hint}>
          Tip: a common rule of thumb is ~30–35 ml per kg of body weight, adjusted for activity.
        </p>
      </div>

      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.message ? <p className={styles.success}>{state.message}</p> : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth loading={pending}>
      Save profile
    </Button>
  );
}
