"use client";

import { useEffect, useState } from "react";

function isAfterEight(): boolean {
  return new Date().getHours() >= 20;
}

/** True from 20:00 local time. Re-checks every minute so an open tab picks up 20:00. */
export function useAfterEight(): boolean {
  const [afterEight, setAfterEight] = useState(false);
  useEffect(() => {
    setAfterEight(isAfterEight());
    const id = window.setInterval(() => setAfterEight(isAfterEight()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return afterEight;
}
