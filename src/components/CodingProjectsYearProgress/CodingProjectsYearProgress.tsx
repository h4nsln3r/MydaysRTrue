"use client";

import { CompletionQuickEdit } from "@/components/CompletionQuickEdit/CompletionQuickEdit";
import {
  CODING_PROJECT_STATUS_LABEL,
  codingProjectVersionLabel,
  formatCodingProjectDate,
  type CodingProject,
} from "@/lib/coding";
import { buildCodingCompletions } from "@/lib/completions";
import styles from "./CodingProjectsYearProgress.module.scss";

interface Props {
  projects: CodingProject[];
}

export function CodingProjectsYearProgress({ projects }: Props) {
  if (projects.length === 0) {
    return <p className={styles.empty}>Inga kodningsprojekt ännu.</p>;
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
              {project.versions.length > 0 ? (
                <ul className={styles.versionSummary}>
                  {project.versions.map((version) => {
                    const completion = buildCodingCompletions([
                      { ...project, versions: [version] },
                    ])[0];
                    return (
                      <li key={version.id} className={styles.versionRow}>
                        <span>
                          {codingProjectVersionLabel(version.versionNumber)} ·{" "}
                          {formatCodingProjectDate(version.completedOn)}
                          {version.note ? ` · ${version.note}` : ""}
                        </span>
                        {completion ? (
                          <CompletionQuickEdit item={completion} />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
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
    </div>
  );
}
