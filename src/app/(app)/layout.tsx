import { Suspense } from "react";
import { AppMenu } from "@/components/AppMenu/AppMenu";
import { BottomNav } from "@/components/BottomNav/BottomNav";
import { NavPendingProvider } from "@/components/NavProgress/NavProgress";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavPendingProvider>
      <div className="app-shell">
        <Suspense fallback={null}>
          <AppMenu />
        </Suspense>
        <div className="container">{children}</div>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      </div>
    </NavPendingProvider>
  );
}
