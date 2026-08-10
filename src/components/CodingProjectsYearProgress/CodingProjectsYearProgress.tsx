import Link from "next/link";
import type { CodingProject } from "@/lib/coding";
import styles from "./CodingProjectsYearProgress.module.scss";

interface Props {
  projects: CodingProject[];
  planHref: string;
}

export function CodingProjectsYearProgress({ projects, planHref }: Props) {
  if (projects.length === 0) {
    return (
      <p className={styles.empty}>
        Inga kodningsprojekt ännu.{" "}
        <Link href={planHref}>Lägg till i planeringen →</Link>
      </p>
    );
  }

  return (
    <div className={styles.board}>
      <ul className={styles.list}>
        {projects.map((project) => (
          <li key={project.id} className={styles.item}>
            <span className={styles.itemIcon} aria-hidden>
              💻
            </span>
            <div className={styles.itemMeta}>
              <p className={styles.itemTitle}>{project.title}</p>
              {project.description ? (
                <p className={styles.itemNote}>{project.description}</p>
              ) : (
                <p className={styles.itemSub}>Ingen beskrivning ännu</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className={styles.hint}>
        <Link href={planHref}>Redigera projekt i planeringen →</Link>
      </p>
    </div>
  );
}
