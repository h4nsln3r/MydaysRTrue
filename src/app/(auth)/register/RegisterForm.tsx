"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/Input/Input";
import { Button } from "@/components/Button/Button";
import { registerAction, type RegisterFormState } from "./actions";
import styles from "../login/login.module.scss";

const initialState: RegisterFormState = {};

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initialState);

  return (
    <form action={action} className={styles.form}>
      <Input
        label="Display name"
        name="displayName"
        type="text"
        autoComplete="nickname"
        placeholder="What should we call you?"
      />
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
        autoComplete="new-password"
        placeholder="At least 8 characters"
        minLength={8}
        required
        hint="At least 8 characters."
      />
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
      Create account
    </Button>
  );
}
