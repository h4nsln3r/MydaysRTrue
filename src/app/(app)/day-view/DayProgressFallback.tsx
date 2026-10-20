import styles from "../dashboard.module.scss";
import skeleton from "./skeleton.module.scss";

const PLAN_ROWS = 7;

function Bone({ className }: { className: string }) {
  return <div className={[skeleton.bone, className].join(" ")} />;
}

/** Matches the day plan card: plus, counter and task rows. */
export function PlanListSkeleton() {
  return (
    <div className={skeleton.card} aria-busy="true" aria-label="Laddar dagens plan">
      <div className={skeleton.planHeader}>
        <Bone className={skeleton.plus} />
        <Bone className={skeleton.counter} />
      </div>
      <div className={skeleton.rows}>
        {Array.from({ length: PLAN_ROWS }, (_, index) => (
          <div key={index} className={skeleton.row}>
            <Bone className={skeleton.handle} />
            <Bone className={skeleton.icon} />
            <Bone className={skeleton.check} />
            <Bone className={index % 3 === 0 ? skeleton.lineShort : skeleton.line} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Matches the tracker stack: water, a board, compact habits and the note field. */
export function TrackersSkeleton() {
  return (
    <div className={skeleton.side} aria-busy="true" aria-label="Laddar dagens översikt">
      <div className={skeleton.card}>
        <div className={skeleton.cardTop}>
          <Bone className={skeleton.line} />
          <Bone className={skeleton.plus} />
        </div>
        <Bone className={skeleton.waterBar} />
      </div>
      <div className={skeleton.card}>
        <Bone className={skeleton.line} />
        <Bone className={skeleton.lineShort} />
        <Bone className={skeleton.chipRow} />
      </div>
      <div className={skeleton.cardCompact}>
        <Bone className={skeleton.icon} />
        <Bone className={skeleton.line} />
      </div>
      <div className={skeleton.cardCompact}>
        <Bone className={skeleton.icon} />
        <Bone className={skeleton.lineShort} />
      </div>
      <div className={skeleton.cardCompact}>
        <Bone className={skeleton.icon} />
        <Bone className={skeleton.line} />
      </div>
      <div className={skeleton.card}>
        <Bone className={skeleton.note} />
      </div>
    </div>
  );
}

/** Matches the journal heading and the narrative card. */
export function JournalSkeleton() {
  return (
    <div aria-busy="true" aria-label="Laddar dagbok">
      <div className={skeleton.journalHead}>
        <div className={skeleton.journalTitles}>
          <Bone className={skeleton.journalTitle} />
          <Bone className={skeleton.lineShort} />
        </div>
        <Bone className={skeleton.journalBadge} />
      </div>
      <div className={skeleton.card}>
        <Bone className={skeleton.lineWide} />
        <Bone className={skeleton.line} />
        <Bone className={skeleton.lineShort} />
      </div>
    </div>
  );
}

/** Matches the water log heading and a couple of entries. */
export function WaterLogSkeleton() {
  return (
    <div aria-busy="true" aria-label="Laddar vattenlogg">
      <div className={skeleton.journalHead}>
        <Bone className={skeleton.journalTitle} />
        <Bone className={skeleton.lineShort} />
      </div>
      <div className={skeleton.cardCompact}>
        <Bone className={skeleton.icon} />
        <Bone className={skeleton.line} />
      </div>
      <div className={skeleton.cardCompact}>
        <Bone className={skeleton.icon} />
        <Bone className={skeleton.lineShort} />
      </div>
    </div>
  );
}

/** Used by the plan-settings view, which is one column of panels. */
export function SideColumnSkeleton() {
  return (
    <div className={skeleton.side}>
      <div className={[skeleton.bone, skeleton.panel].join(" ")} />
      <div className={[skeleton.bone, skeleton.panel].join(" ")} />
      <div className={[skeleton.bone, skeleton.panelShort].join(" ")} />
    </div>
  );
}

/** @deprecated Use PlanListSkeleton. Kept so older fallbacks still render a list. */
export function PlanColumnSkeleton() {
  return <PlanListSkeleton />;
}

export function BlockSkeleton() {
  return <JournalSkeleton />;
}

/** Full progress shell. Each section also has its own fallback where it streams in. */
export function DayProgressFallback({
  upcoming = false,
  showWaterLog = false,
}: {
  upcoming?: boolean;
  showWaterLog?: boolean;
}) {
  return (
    <>
      <div
        className={upcoming ? undefined : styles.dashboard}
        aria-busy="true"
        aria-label="Laddar dagen"
      >
        <section className={styles.section}>
          <PlanListSkeleton />
        </section>
        {upcoming ? null : (
          <section className={styles.section}>
            <TrackersSkeleton />
          </section>
        )}
      </div>
      {upcoming ? null : (
        <section className={styles.section}>
          <JournalSkeleton />
        </section>
      )}
      {showWaterLog && !upcoming ? (
        <section className={styles.section}>
          <WaterLogSkeleton />
        </section>
      ) : null}
    </>
  );
}
