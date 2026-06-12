import { BottomNav } from "@/components/BottomNav/BottomNav";
import { NavPendingProvider } from "@/components/NavProgress/NavProgress";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavPendingProvider>
      <div className="app-shell">
        <div className="container">{children}</div>
        <BottomNav />
      </div>
    </NavPendingProvider>
  );
}
