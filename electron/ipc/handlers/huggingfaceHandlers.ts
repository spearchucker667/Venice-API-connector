/** @fileoverview Hugging Face Inference Providers model-discovery IPC handlers.
 *  The renderer never touches the HF API token; the main process performs the
 *  discovery request using the profile-scoped key and returns a normalized,
 *  redacted catalog result.
 */

import { registerPrivilegedIpcChannel } from "./common";
import { getHuggingFaceModelCatalog } from "../../services/huggingfaceDiscovery";
import { getProfileSessionId } from "../../services/profileSession";
import { redactErrorMessage } from "../../../src/shared/redaction";

export function registerHuggingfaceHandlers(): void {
  registerPrivilegedIpcChannel("huggingface:getModelCatalog", async (event, raw: unknown) => {
    try {
      const profileId = getProfileSessionId(event.sender);
      const force = Boolean(
        raw && typeof raw === "object" && !Array.isArray(raw) && (raw as Record<string, unknown>).force === true,
      );
      return await getHuggingFaceModelCatalog(profileId, { force });
    } catch (err: unknown) {
      return {
        providerId: "huggingface",
        models: [],
        fetchedAt: Date.now(),
        stale: true,
        source: "bundled",
        error: redactErrorMessage(err),
      };
    }
  });
}
