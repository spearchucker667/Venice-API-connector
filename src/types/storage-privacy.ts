import type { ApiKeyValidationStatus, SafeApiKeyMetadata, SafeApiKeyStorage } from "./api-connectivity";

export type StoragePrivacySeverity = "ok" | "info" | "warn" | "error";

export type StoragePrivacyCategory =
  | "projects"
  | "conversations"
  | "media"
  | "prompts"
  | "scenes"
  | "rp"
  | "workflows"
  | "settings"
  | "api_keys"
  | "diagnostics"
  | "cache"
  | "unknown";

/** Per-provider API key entry. The `keyPreview` and `keyTail` are short,
 *  non-secret display fragments (e.g. `sk-…abcd`) intended for at-a-glance
 *  identity confirmation only. The actual key never leaves secure storage. */
export interface ActiveApiKeyEntry {
  id: string;
  providerId: string;
  label: string;
  configured: boolean;
  storage: SafeApiKeyStorage;
  /** Last validation outcome, if any. `null` means "never tested in this session". */
  lastValidationStatus: ApiKeyValidationStatus;
  /** ISO timestamp of the last successful validation, or null if never validated. */
  lastValidationAt: string | null;
  /** Short display tail like `…abcd` (last 4 chars of the key fingerprint). */
  keyTail: string | null;
  /** Whether the provider is also enabled as a routing target. */
  enabledAsProvider: boolean;
}

export interface StorageStoreInventoryItem {
  id: string;
  label: string;
  category: StoragePrivacyCategory;
  storeName?: string;
  count?: number;
  scopedCount?: number;
  unscopedCount?: number;
  archivedCount?: number;
  encrypted: boolean | "unknown";
  containsSecrets: boolean | "unknown";
  containsUserContent: boolean;
  exportableInSafeSummary: boolean;
  severity: StoragePrivacySeverity;
  summary: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface StorageReferenceIssue {
  id: string;
  severity: StoragePrivacySeverity;
  sourceCategory: StoragePrivacyCategory;
  sourceId?: string;
  targetCategory?: StoragePrivacyCategory;
  targetId?: string;
  message: string;
  repairable: boolean;
}

export interface StorageInventoryResult {
  stores: StorageStoreInventoryItem[];
  /** Per-provider API key audit trail. Surfaced on the Privacy tab so the
   *  user can see exactly which credentials are configured, where they live,
   *  and the last validation result — without the raw key value being
   *  exposed. */
  activeApiKeys: ActiveApiKeyEntry[];
  issues: StorageReferenceIssue[];
  generatedAt: string;
}

export interface StorageMaintenanceAction {
  id: string;
  label: string;
  description: string;
  destructive: boolean;
  requiresConfirmation: boolean;
  dryRunOnly?: boolean;
  affectedCategories: StoragePrivacyCategory[];
}

export interface StorageMaintenancePlan {
  version: 1;
  generatedAt: string;
  actions: StorageMaintenanceAction[];
  issues: StorageReferenceIssue[];
  warnings: Array<{
    id: string;
    severity: StoragePrivacySeverity;
    message: string;
  }>;
}

export interface SafePrivacySummary {
  version: 1;
  generatedAt: string;
  app: "Venice Forge";
  stores: StorageStoreInventoryItem[];
  counts: Record<string, number>;
  issues: StorageReferenceIssue[];
  exclusions: string[];
  apiKey: SafeApiKeyMetadata;
  /** Optional breakdown of every configured provider key. Mirrors
   *  `StorageInventoryResult.activeApiKeys` and is omitted from older
   *  summaries that predate the dedicated panel. */
  activeApiKeys?: ActiveApiKeyEntry[];
}
