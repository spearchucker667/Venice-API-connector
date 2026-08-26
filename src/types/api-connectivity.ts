/** @fileoverview Safe API-key and Venice connectivity status contracts. */

export type ApiConnectivityEndpoint = "models" | "chat" | "catalog" | "health";

export type ApiConnectivityFailureKind =
  | "missing-api-key"
  | "invalid-api-key"
  | "invalid-configuration"
  | "model-not-found"
  | "deployment-not-found"
  | "rate-limited"
  | "network-failure"
  | "venice-error"
  | "proxy-failure"
  | "bridge-unavailable"
  | "catalog-failure"
  | "provider-unavailable"
  | "unknown";

export type ApiConnectivityStatus =
  | {
      ok: true;
      kind: "verified";
      checkedAt: string;
      statusCode?: number;
      endpoint: ApiConnectivityEndpoint;
    }
  | {
      ok: false;
      kind: ApiConnectivityFailureKind;
      checkedAt: string;
      statusCode?: number;
      safeMessage: string;
      retryable: boolean;
    };

/** Normalized result from a provider-specific connection/configuration test.
 *  Mirrors ApiConnectivityStatus but is provider-scoped and includes a
 *  human-readable message safe for UI surfacing. */
export type ProviderConnectionResult = {
  ok: boolean;
  providerId: string;
  statusCode?: number;
  kind:
    | "verified"
    | "missing-credential"
    | "invalid-credential"
    | "invalid-configuration"
    | "model-not-found"
    | "deployment-not-found"
    | "rate-limited"
    | "provider-unavailable"
    | "network-failure"
    | "timeout"
    | "unknown";
  message: string;
  checkedAt: string;
  connectivity: ApiConnectivityStatus;
};

export type ApiKeyValidationStatus =
  | "not-configured"
  | "configured-not-validated"
  | "valid"
  | "invalid"
  | "network-error"
  | "bridge-error"
  | "unknown";

export type SafeApiKeyStorage =
  | "secure-storage"
  | "memory"
  | "env"
  | "web-environment"
  | "unavailable";

export type CredentialFailureCode =
  | "INVALID_KEY"
  | "PROVIDER_AUTH_REJECTED"
  | "SECRET_STORAGE_UNAVAILABLE"
  | "SECRET_STORAGE_WRITE_FAILED"
  | "SECRET_STORAGE_READ_FAILED"
  | "SECRET_DECRYPT_FAILED"
  | "CREDENTIAL_NOT_CONFIGURED"
  | "CREDENTIAL_STATE_INCONSISTENT"
  | "PROFILE_NOT_FOUND"
  | "IPC_REJECTED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export type CredentialStorageMode = "encrypted" | "plaintext-fallback" | "unavailable";

export type ApiKeyConfigurationStatus = {
  configured: boolean;
  state: "configured" | "not-configured" | "load-failed";
  storageMode: CredentialStorageMode;
  failureCode?: CredentialFailureCode;
  safeMessage?: string;
};

export type ApiKeyMutationResult =
  | { ok: true; storageMode: CredentialStorageMode }
  | {
      ok: false;
      code: CredentialFailureCode;
      safeMessage: string;
    };

export interface SafeApiKeyMetadata {
  configured: boolean;
  storage: SafeApiKeyStorage;
  exported: false;
  redacted: true;
  reason: string;
  lastValidationStatus: ApiKeyValidationStatus;
  lastValidationAt: string | null;
}

export function buildSafeApiKeyMetadata(input: {
  configured: boolean;
  storage: SafeApiKeyStorage;
  lastValidationStatus?: ApiKeyValidationStatus;
  lastValidationAt?: string | null;
}): SafeApiKeyMetadata {
  return {
    configured: input.configured,
    storage: input.storage,
    exported: false,
    redacted: true,
    reason: "API keys are excluded from safe summaries and exports.",
    lastValidationStatus:
      input.lastValidationStatus ??
      (input.configured ? "configured-not-validated" : "not-configured"),
    lastValidationAt: input.lastValidationAt ?? null,
  };
}

export function validationStatusFromConnectivity(
  status: ApiConnectivityStatus | null | undefined,
  configured: boolean,
): ApiKeyValidationStatus {
  if (!configured) return "not-configured";
  if (!status) return "configured-not-validated";
  if (status.ok) return "valid";
  if (status.kind === "invalid-api-key") return "invalid";
  if (status.kind === "network-failure" || status.kind === "catalog-failure") return "network-error";
  if (status.kind === "bridge-unavailable" || status.kind === "proxy-failure") return "bridge-error";
  return "unknown";
}
