"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import { loginAction, type AuthFormState } from "./actions";
import styles from "./login.module.scss";

const initialState: AuthFormState = {};

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@mydays.app"
        required
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
      />
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth loading={pending}>
      Sign in
    </Button>
  );
}
