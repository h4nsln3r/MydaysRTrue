"use client";

import { useTransition } from "react";
import { Button } from "@/components/Button/Button";
import { signOutAction } from "../actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      onClick={() => startTransition(() => signOutAction())}
      loading={pending}
    >
      Sign out
    </Button>
  );
}
