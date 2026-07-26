import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MasterPasswordDialog } from "./MasterPasswordDialog";
import { useProfileStore } from "../../stores/profile-store";
import { toast } from "../../stores/toast-store";

export interface SafetyPanelProps {
  localFamilySafeModeEnabled: boolean;
  veniceApiSafeMode: boolean;
  onUpdateSafetySetting: (
    key: "local_family_safe_mode_enabled" | "venice_api_safe_mode",
    enabled: boolean,
  ) => Promise<void> | void;
}

export function SafetyPanel({
  localFamilySafeModeEnabled,
  veniceApiSafeMode,
  onUpdateSafetySetting,
}: SafetyPanelProps): React.ReactElement {
  const { t: tRuntime } = useTranslation("common");
  const { t } = useTranslation(["settings", "common"]);
  const { masterPasswordSet } = useProfileStore();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    key: "local_family_safe_mode_enabled" | "venice_api_safe_mode";
    enabled: boolean;
  } | null>(null);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[14.5px] font-medium text-text-primary">
              {t("settings:safety.familySafeModeTitle", "Family Safe Mode")}
            </h3>
            <p className="mt-1 text-[12.5px] text-text-secondary leading-relaxed">
              {t(
                "settings:safety.familySafeModeDescription",
                "Runs Venice Forge's local family-safe filter before sending requests. Designed for child/family-safe use.",
              )}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={localFamilySafeModeEnabled}
              onChange={(event) => {
                // Force a master password setup before any toggle is committed.
                // Without a master password, an attacker (or a curious sibling) who
                // sits down at the unlocked app can flip Family Safe Mode with
                // one click. Routing through the dialog also lets the dialog run
                // in "setup" mode the first time and "verify" mode afterwards.
                setPendingAction({
                  key: "local_family_safe_mode_enabled",
                  enabled: event.target.checked,
                });
                setShowPasswordDialog(true);
              }}
              className="h-4 w-4 rounded border-border bg-surface text-accent"
            />
            <span className="text-[12.5px] font-medium text-text-primary">
              {localFamilySafeModeEnabled
                ? t("settings:safety.onFamilySafeMode", "ON: Family Safe Mode")
                : t(
                    "settings:safety.offAdultMode",
                    "OFF: Adult Mode (Local Filter OFF)",
                  )}
            </span>
          </label>
        </div>

        <p className="text-[12px] text-text-muted leading-relaxed">
          {localFamilySafeModeEnabled
            ? t(
                "settings:safety.status.enabled",
                "When enabled, matching requests are blocked locally before the provider is called.",
              )
            : t(
                "settings:safety.status.disabled",
                "Bypasses Venice Forge's local family-safe filter. Note: Venice API provider-side Safe Mode is controlled separately below.",
              )}
        </p>

        <div className="rounded-lg bg-surface-base p-3 border border-border text-[12px] space-y-1">
          <div className="font-medium text-text-primary">
            {t("settings:safety.effectiveStatus", {
              defaultValue:
                "Effective Status: Local filter: {{local}} | Venice provider filtering: {{provider}}",
              local: localFamilySafeModeEnabled ? "ON" : "OFF",
              provider: veniceApiSafeMode ? "ON" : "OFF",
            })}
          </div>
          <div className="text-text-muted">
            {!localFamilySafeModeEnabled && veniceApiSafeMode
              ? t(
                  "settings:safety.status.localOffProviderOn",
                  "Local family filter is OFF, but Venice API provider-side Safe Mode is still ON. Outbound requests include safe_mode: true.",
                )
              : !localFamilySafeModeEnabled && !veniceApiSafeMode
                ? t(
                    "settings:safety.status.bothOff",
                    "Both local family filter and Venice API provider Safe Mode are OFF. Outbound requests include safe_mode: false.",
                  )
                : t(
                    "settings:safety.status.filteredLocally",
                    "Matching requests are filtered locally before reaching the provider.",
                  )}
          </div>
        </div>

        <div className="mt-2">
          {!masterPasswordSet ? (
            <button
              className="text-[12.5px] text-accent underline"
              onClick={() => {
                setPendingAction(null);
                setShowPasswordDialog(true);
              }}
            >
              {t(
                "settings:safety.setMasterPassword",
                "Set Master Password to lock Family Safe Mode",
              )}
            </button>
          ) : (
            <span className="text-[12.5px] text-green-500">
              {t(
                "settings:safety.masterPasswordEnabled",
                "Master Password is enabled",
              )}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[14.5px] font-medium text-text-primary">
              {t(
                "settings:safety.veniceApiSafeModeTitle",
                "Venice API Safe Mode",
              )}
            </h3>
            <p className="mt-1 text-[12.5px] text-text-secondary leading-relaxed">
              {t(
                "settings:safety.veniceApiSafeModeDescription",
                "Controls the provider-side safemode parameter sent to Venice. This is separate from Family Safe Mode.",
              )}
            </p>
          </div>
          <input
            type="checkbox"
            aria-label={tRuntime(
              "runtimeGenerated.components.settings.safetypanel.attribute.veniceApiSafeMode",
            )}
            checked={veniceApiSafeMode}
            onChange={(event) => {
              if (localFamilySafeModeEnabled && !event.target.checked) {
                toast.error(
                  t(
                    "settings:safety.errors.cannotDisableTitle",
                    "Cannot disable Provider Safe Mode",
                  ),
                  t(
                    "settings:safety.errors.cannotDisableDetail",
                    "Family Safe Mode must be turned off first.",
                  ),
                );
                return;
              }
              onUpdateSafetySetting(
                "venice_api_safe_mode",
                event.target.checked,
              );
            }}
            className="h-4 w-4 rounded border-border bg-surface text-accent cursor-pointer"
          />
        </div>
      </div>

      {showPasswordDialog && (
        <MasterPasswordDialog
          isOpen={showPasswordDialog}
          mode={masterPasswordSet ? "verify" : "setup"}
          onClose={() => setShowPasswordDialog(false)}
          onSuccess={() => {
            setShowPasswordDialog(false);
            if (pendingAction) {
              onUpdateSafetySetting(pendingAction.key, pendingAction.enabled);
              setPendingAction(null);
            }
          }}
        />
      )}
    </div>
  );
}
