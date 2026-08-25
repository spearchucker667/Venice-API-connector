import { synthesizeSpeech, clearTtsCache } from "../../services/chatTtsBridge";
import { getProfileSessionId } from "../../services/profileSession";
import { registerPrivilegedIpcChannel } from "./common";

export function registerChatTtsHandlers() {
  registerPrivilegedIpcChannel("tts:synthesize", async (event, opts: unknown, cacheEnabled: unknown) => {
    return synthesizeSpeech(opts, cacheEnabled, getProfileSessionId(event.sender));
  });

  registerPrivilegedIpcChannel("tts:clearCache", async (event) => {
    return clearTtsCache(getProfileSessionId(event.sender));
  });
}
