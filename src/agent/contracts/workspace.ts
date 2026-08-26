import type { DocumentFormat } from "./documents";

/** A single entry returned by a bounded workspace listing. */
export interface WorkspaceEntry {
  relativePath: string;
  kind: "file" | "directory";
  sizeBytes: number;
  modifiedAt: string;
}

/** Paginated result from `WorkspaceFilesystemService.list()`. */
export interface WorkspaceListResult {
  entries: WorkspaceEntry[];
  nextOffset: number | null;
}

/** A single text search match inside the granted workspace. */
export interface WorkspaceSearchResult {
  relativePath: string;
  line: number;
  snippet: string;
}

export type WorkspaceChange =
  | { type: "create_file"; relativePath: string; expectedAbsent: true; format: DocumentFormat; content: string }
  | { type: "replace_file"; relativePath: string; expectedContentHash: string; format: DocumentFormat; content: string }
  | { type: "patch_text_file"; relativePath: string; expectedContentHash: string; replacements: Array<{ expectedText: string; replacementText: string; occurrence: number }> }
  | { type: "create_directory"; relativePath: string; expectedAbsent: true };

export interface WorkspaceChangeProposal {
  workspaceId: string;
  baseSnapshotId: string;
  summary: string;
  changes: WorkspaceChange[];
}

export interface WorkspaceRecoveryRecord {
  id: string;
  workspaceId: string;
  originalRelativePath: string;
  stagedName: string;
  createdAt: string;
  restoredAt?: string;
}
