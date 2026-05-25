import { WaterLogItem } from "@/components/WaterLogItem/WaterLogItem";
import type { WaterLog } from "@/lib/water";
import styles from "./add-water.module.scss";

export function RecentLogs({ logs }: { logs: WaterLog[] }) {
  if (logs.length === 0) {
    return <p className={styles.empty}>Nothing logged yet today.</p>;
  }

  return (
    <ul className={styles.logList}>
      {logs.map((log) => (
        <WaterLogItem key={log.id} log={log} />
      ))}
    </ul>
  );
}
