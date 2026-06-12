"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useNavPending } from "@/components/NavProgress/NavProgress";
import styles from "./BottomNav.module.scss";

type IconName = "home" | "week" | "month" | "year" | "user";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  isActive: (pathname: string) => boolean;
}

const items: NavItem[] = [
  {
    href: "/",
    label: "Day",
    icon: "home",
    isActive: (p) =>
      p === "/" ||
      p.startsWith("/day") ||
      p.startsWith("/water") ||
      p.startsWith("/add-water"),
  },
  {
    href: "/week",
    label: "Week",
    icon: "week",
    isActive: (p) => p.startsWith("/week"),
  },
  {
    href: "/month",
    label: "Month",
    icon: "month",
    isActive: (p) => p.startsWith("/month"),
  },
  {
    href: "/year",
    label: "Year",
    icon: "year",
    isActive: (p) => p.startsWith("/year"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: "user",
    isActive: (p) => p.startsWith("/profile"),
  },
];

export function BottomNav() {
  const router = useRouter();

  useEffect(() => {
    for (const item of items) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <nav className={styles.nav} aria-label="Primary">
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href} className={styles.item}>
            <Link
              href={item.href}
              prefetch
              className={styles.linkWrap}
            >
              <BottomNavLinkContent item={item} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BottomNavLinkContent({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const { pending } = useLinkStatus();
  const { setPending } = useNavPending();
  const active = item.isActive(pathname);

  useEffect(() => {
    setPending(pending);
    return () => setPending(false);
  }, [pending, setPending]);

  return (
    <span
      className={[
        styles.link,
        active ? styles.active : "",
        pending ? styles.pending : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </span>
  );
}

function Icon({ name }: { name: IconName }) {
  switch (name) {
    case "home":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "week":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
          <path
            d="M8 3v4M16 3v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="8" cy="15" r="1.2" fill="currentColor" />
          <circle cx="12" cy="15" r="1.2" fill="currentColor" />
          <circle cx="16" cy="15" r="1.2" fill="currentColor" />
        </svg>
      );
    case "month":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="3"
            y="5"
            width="18"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
          <path
            d="M8 3v4M16 3v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="8" cy="14" r="1" fill="currentColor" />
          <circle cx="12" cy="14" r="1" fill="currentColor" />
          <circle cx="16" cy="14" r="1" fill="currentColor" />
          <circle cx="8" cy="18" r="1" fill="currentColor" />
          <circle cx="12" cy="18" r="1" fill="currentColor" />
          <circle cx="16" cy="18" r="1" fill="currentColor" />
        </svg>
      );
    case "year":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="3"
            y="4"
            width="18"
            height="17"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M3 9h18" stroke="currentColor" strokeWidth="2" />
          <path
            d="M8 2v4M16 2v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <text
            x="12"
            y="18"
            textAnchor="middle"
            fill="currentColor"
            fontSize="7"
            fontWeight="700"
            fontFamily="system-ui, sans-serif"
          >
            12
          </text>
        </svg>
      );
    case "user":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="2" />
          <path
            d="M5 20c1.2-3.4 4-5 7-5s5.8 1.6 7 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
