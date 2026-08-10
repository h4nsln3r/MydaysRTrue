"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCodingProjectVersionAction,
  archiveCodingProjectAction,
  createCodingProjectAction,
  deleteCodingProjectVersionAction,
  updateCodingProjectAction,
  updateCodingProjectVersionAction,
} from "@/app/(app)/coding-actions";
import { Button } from "@/components/Button/Button";
import { Input } from "@/components/Input/Input";
import {
  CODING_PROJECT_STATUSES,
  CODING_PROJECT_STATUS_LABEL,
  codingProjectVersionLabel,
  formatCodingProjectDate,
  type CodingProject,
  type CodingProjectStatus,
  type CodingProjectVersion,
} from "@/lib/coding";
import { todayLocalISO } from "@/lib/date";
import styles from "./CodingProjectsYearBoard.module.scss";

interface Props {
  projects: CodingProject[];
  /** Only the create form (used under the progress list). */
  createOnly?: boolean;
}

export function CodingProjectsYearBoard({
  projects,
  createOnly = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState<CodingProjectStatus>("active");

  const add = () => {
    if (!title.trim()) {
      setError("Skriv ett projektnamn.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createCodingProjectAction({
        title,
        description,
        githubUrl,
        liveUrl,
        isLive,
        status,
      });
      if (!res.ok) {
        setError(res.error ?? "Kunde inte lägga till.");
        return;
      }
      setTitle("");
      setDescription("");
      setGithubUrl("");
      setLiveUrl("");
      setIsLive(false);
      setStatus("active");
      router.refresh();
    });
  };

  const form = (
    <div className={styles.form}>
      <p className={styles.hint}>Lägg till projekt</p>
      <Input
        label="Namn"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="t.ex. Mydays, Portfolio"
        maxLength={120}
        disabled={pending}
      />
      <Input
        label="Beskrivning (valfritt)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Vad handlar projektet om?"
        maxLength={500}
        disabled={pending}
      />
      <Input
        label="GitHub (valfritt)"
        value={githubUrl}
        onChange={(e) => setGithubUrl(e.target.value)}
        placeholder="github.com/dig/repo"
        maxLength={300}
        disabled={pending}
      />
      <Input
        label="Live-sida (valfritt)"
        value={liveUrl}
        onChange={(e) => setLiveUrl(e.target.value)}
        placeholder="mydays.app"
        maxLength={300}
        disabled={pending}
      />
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={isLive}
          onChange={(e) => setIsLive(e.target.checked)}
          disabled={pending || !liveUrl.trim()}
        />
        <span>Sidan ligger uppe</span>
      </label>
      <label className={styles.statusField}>
        <span className={styles.statusLabel}>Projektstatus</span>
        <select
          className={styles.statusSelect}
          value={status}
          disabled={pending}
          onChange={(e) => setStatus(e.target.value as CodingProjectStatus)}
        >
          {CODING_PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CODING_PROJECT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        variant="primary"
        size="md"
        fullWidth
        loading={pending}
        disabled={pending}
        onClick={add}
      >
        Lägg till
      </Button>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );

  if (createOnly) {
    return <div className={styles.board}>{form}</div>;
  }

  return (
    <div className={styles.board}>
      <p className={styles.hint}>
        Projekt du kodar på. Markera versioner med datum (första, andra, …) och
        ange GitHub/live-länk om du vill.
      </p>

      {projects.length > 0 ? (
        <ul className={styles.list}>
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              pending={pending}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Inga projekt ännu.</p>
      )}

      {form}
    </div>
  );
}

interface ProjectRowProps {
  project: CodingProject;
  pending: boolean;
  onError: (msg: string | null) => void;
}

function ProjectRow({ project, pending, onError }: ProjectRowProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDescription, setEditDescription] = useState(
    project.description ?? "",
  );
  const [editGithubUrl, setEditGithubUrl] = useState(project.githubUrl ?? "");
  const [editLiveUrl, setEditLiveUrl] = useState(project.liveUrl ?? "");
  const [editIsLive, setEditIsLive] = useState(project.isLive);
  const [editStatus, setEditStatus] = useState<CodingProjectStatus>(
    project.status,
  );
  const [newVersionDate, setNewVersionDate] = useState(todayLocalISO());
  const [localPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = pending || localPending;
  const nextVersionNumber = (project.versions.at(-1)?.versionNumber ?? 0) + 1;

  const startEdit = () => {
    setEditTitle(project.title);
    setEditDescription(project.description ?? "");
    setEditGithubUrl(project.githubUrl ?? "");
    setEditLiveUrl(project.liveUrl ?? "");
    setEditIsLive(project.isLive);
    setEditStatus(project.status);
    setNewVersionDate(todayLocalISO());
    setLocalError(null);
    onError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setLocalError(null);
  };

  const saveEdit = () => {
    if (!editTitle.trim()) {
      setLocalError("Skriv ett projektnamn.");
      return;
    }

    setLocalError(null);
    onError(null);
    startTransition(async () => {
      const res = await updateCodingProjectAction({
        id: project.id,
        title: editTitle,
        description: editDescription,
        githubUrl: editGithubUrl,
        liveUrl: editLiveUrl,
        isLive: editIsLive,
        status: editStatus,
      });
      if (!res.ok) {
        setLocalError(res.error ?? "Kunde inte spara.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  };

  const addVersion = () => {
    setLocalError(null);
    onError(null);
    startTransition(async () => {
      const res = await addCodingProjectVersionAction({
        projectId: project.id,
        completedOn: newVersionDate,
      });
      if (!res.ok) {
        setLocalError(res.error ?? "Kunde inte lägga till version.");
        return;
      }
      setNewVersionDate(todayLocalISO());
      router.refresh();
    });
  };

  const remove = () => {
    onError(null);
    startTransition(async () => {
      const res = await archiveCodingProjectAction({ id: project.id });
      if (!res.ok) onError(res.error ?? "Kunde inte ta bort.");
      router.refresh();
    });
  };

  if (isEditing) {
    return (
      <li className={[styles.itemWrap, styles.itemEditing].join(" ")}>
        <div className={styles.item}>
          <span className={styles.itemIcon} aria-hidden>
            💻
          </span>
          <div className={styles.editForm}>
            <Input
              label="Namn"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={120}
              disabled={busy}
            />
            <Input
              label="Beskrivning (valfritt)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Vad handlar projektet om?"
              maxLength={500}
              disabled={busy}
            />
            <Input
              label="GitHub (valfritt)"
              value={editGithubUrl}
              onChange={(e) => setEditGithubUrl(e.target.value)}
              placeholder="github.com/dig/repo"
              maxLength={300}
              disabled={busy}
            />
            <Input
              label="Live-sida (valfritt)"
              value={editLiveUrl}
              onChange={(e) => setEditLiveUrl(e.target.value)}
              placeholder="mydays.app"
              maxLength={300}
              disabled={busy}
            />
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={editIsLive}
                onChange={(e) => setEditIsLive(e.target.checked)}
                disabled={busy || !editLiveUrl.trim()}
              />
              <span>Sidan ligger uppe</span>
            </label>
            <label className={styles.statusField}>
              <span className={styles.statusLabel}>Projektstatus</span>
              <select
                className={styles.statusSelect}
                value={editStatus}
                disabled={busy}
                onChange={(e) =>
                  setEditStatus(e.target.value as CodingProjectStatus)
                }
              >
                {CODING_PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CODING_PROJECT_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.versionsBlock}>
              <p className={styles.versionsTitle}>Versioner</p>
              {project.versions.length > 0 ? (
                <ul className={styles.versionList}>
                  {project.versions.map((version) => (
                    <VersionEditRow
                      key={version.id}
                      version={version}
                      busy={busy}
                      onError={setLocalError}
                    />
                  ))}
                </ul>
              ) : (
                <p className={styles.itemSub}>Inga versioner markerade ännu.</p>
              )}
              <div className={styles.addVersionRow}>
                <Input
                  label={`När blev ${codingProjectVersionLabel(nextVersionNumber).toLowerCase()} klar?`}
                  type="date"
                  value={newVersionDate}
                  onChange={(e) => setNewVersionDate(e.target.value)}
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  loading={busy}
                  disabled={busy}
                  onClick={addVersion}
                >
                  Lägg till {codingProjectVersionLabel(nextVersionNumber).toLowerCase()}
                </Button>
              </div>
            </div>

            {localError ? <p className={styles.error}>{localError}</p> : null}
            <div className={styles.editActions}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={busy}
                onClick={cancelEdit}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={busy}
                disabled={busy}
                onClick={saveEdit}
              >
                Spara
              </Button>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className={styles.itemWrap}>
      <div className={styles.item}>
        <span className={styles.itemIcon} aria-hidden>
          💻
        </span>
        <div className={styles.itemMeta}>
          <span className={styles.itemTitle}>{project.title}</span>
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
            <span className={styles.itemNote}>{project.description}</span>
          ) : (
            <span className={styles.itemSub}>Ingen beskrivning ännu</span>
          )}
          {project.versions.length > 0 ? (
            <ul className={styles.versionSummary}>
              {project.versions.map((version) => (
                <li key={version.id}>
                  {codingProjectVersionLabel(version.versionNumber)} ·{" "}
                  {formatCodingProjectDate(version.completedOn)}
                </li>
              ))}
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
        <button
          type="button"
          className={styles.editBtn}
          onClick={startEdit}
          disabled={busy}
        >
          Redigera
        </button>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={remove}
          disabled={busy}
        >
          Arkivera
        </button>
      </div>
    </li>
  );
}

function VersionEditRow({
  version,
  busy,
  onError,
}: {
  version: CodingProjectVersion;
  busy: boolean;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(version.completedOn);
  const [localPending, startTransition] = useTransition();
  const rowBusy = busy || localPending;
  const dirty = date !== version.completedOn;

  const save = () => {
    onError(null);
    startTransition(async () => {
      const res = await updateCodingProjectVersionAction({
        id: version.id,
        completedOn: date,
      });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte spara datum.");
        return;
      }
      router.refresh();
    });
  };

  const remove = () => {
    onError(null);
    startTransition(async () => {
      const res = await deleteCodingProjectVersionAction({ id: version.id });
      if (!res.ok) {
        onError(res.error ?? "Kunde inte ta bort version.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <li className={styles.versionEditRow}>
      <span className={styles.versionLabel}>
        {codingProjectVersionLabel(version.versionNumber)}
      </span>
      <input
        type="date"
        className={styles.versionDate}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={rowBusy}
      />
      {dirty ? (
        <button
          type="button"
          className={styles.editBtn}
          onClick={save}
          disabled={rowBusy}
        >
          Spara datum
        </button>
      ) : null}
      <button
        type="button"
        className={styles.removeBtn}
        onClick={remove}
        disabled={rowBusy}
      >
        Ta bort
      </button>
    </li>
  );
}
