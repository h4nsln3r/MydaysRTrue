// Client-safe coding project helpers. Server queries live in `./coding.server`.

export interface CodingProject {
  id: string;
  title: string;
  /** Optional longer blurb — edited on the year view. */
  description: string | null;
  sortOrder: number;
}
