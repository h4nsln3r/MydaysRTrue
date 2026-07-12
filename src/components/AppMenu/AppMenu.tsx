"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavPending } from "@/components/NavProgress/NavProgress";
import styles from "./AppMenu.module.scss";

interface MenuRoute {
  href: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
}

const menuRoutes: MenuRoute[] = [
  {
    href: "/profile",
    label: "Profile",
    icon: <UserIcon />,
    isActive: (pathname) => pathname === "/profile",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <SettingsIcon />,
    isActive: (pathname) =>
      pathname.startsWith("/settings") || pathname.startsWith("/profile/"),
  },
];

export function AppMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const menuActive = menuRoutes.some((route) => route.isActive(pathname));

  useEffect(() => {
    for (const route of menuRoutes) {
      router.prefetch(route.href);
    }
  }, [router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (event: MouseEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.bar}>
      <div className={styles.barInner}>
        <div className={styles.wrap} ref={wrapRef}>
          <button
            type="button"
            className={[
              styles.menuBtn,
              open ? styles.menuBtnOpen : "",
              menuActive ? styles.menuBtnActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label="Meny"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((prev) => !prev)}
          >
            <MenuIcon />
          </button>

          {open ? (
            <div className={styles.dropdown} role="menu">
              {menuRoutes.map((route) => (
                <MenuItem
                  key={route.href}
                  route={route}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MenuItem({
  route,
  onNavigate,
}: {
  route: MenuRoute;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const active = route.isActive(pathname);

  return (
    <Link
      href={route.href}
      prefetch
      className={styles.menuItemLink}
      role="menuitem"
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <MenuItemLabel active={active} icon={route.icon} label={route.label} />
    </Link>
  );
}

function MenuItemLabel({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
}) {
  const { pending } = useLinkStatus();
  const { setPending } = useNavPending();

  useEffect(() => {
    setPending(pending);
    return () => setPending(false);
  }, [pending, setPending]);

  return (
    <span
      className={[
        styles.menuItem,
        active ? styles.menuItemActive : "",
        pending ? styles.menuItemPending : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      {label}
    </span>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
