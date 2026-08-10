import Link from "next/link";
import {
  CODING_PROJECT_STATUS_LABEL,
  type CodingProject,
} from "@/lib/coding";
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
              <div className={styles.badgeRow}>
                <span
                  className={[
                    styles.badge,
                    project.status === "done"
                      ? styles.badgeDone
                      : project.status === "v1_done"
                        ? styles.badgeV1
                        : styles.badgeActive,
                  ].join(" ")}
                >
                  {CODING_PROJECT_STATUS_LABEL[project.status]}
                </span>
                {project.liveUrl ? (
                  <span
                    className={[
                      styles.badge,
                      project.isLive ? styles.badgeLive : styles.badgeOffline,
                    ].join(" ")}
                  >
                    {project.isLive ? "Uppe" : "Ej uppe"}
                  </span>
                ) : null}
              </div>
              {project.description ? (
                <p className={styles.itemNote}>{project.description}</p>
              ) : (
                <p className={styles.itemSub}>Ingen beskrivning ännu</p>
              )}
              <div className={styles.linkRow}>
                {project.githubUrl ? (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    GitHub
                  </a>
                ) : null}
                {project.liveUrl ? (
                  <a
                    href={project.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    Live
                  </a>
                ) : null}
              </div>
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
