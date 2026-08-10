// Client-safe coding project helpers. Server queries live in `./coding.server`.

export interface CodingProject {
  id: string;
  title: string;
  sortOrder: number;
}
