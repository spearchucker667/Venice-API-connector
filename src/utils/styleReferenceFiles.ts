import { hashReferenceContent } from "../services/sceneReferencePlanner";

const SUPPORTED_STYLE_REFERENCE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** GenerateImageRequest requires each style reference to be less than 8 MiB. */
export const MAX_STYLE_REFERENCE_BYTES = 8 * 1024 * 1024;

export type StyleReferenceFileErrorCode =
  | "unsupported-type"
  | "empty-file"
  | "too-large"
  | "read-failed";

export class StyleReferenceFileError extends Error {
  constructor(public readonly code: StyleReferenceFileErrorCode) {
    super(code);
    this.name = "StyleReferenceFileError";
  }
}

export interface StyleReferenceInput {
  entityId: string;
  name: string;
  mimeType: string;
  contentHash: string;
  data: string;
  strength: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new StyleReferenceFileError("read-failed"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new StyleReferenceFileError("read-failed"));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function referenceId(): string {
  return `style-reference-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export async function readStyleReferenceFile(file: File): Promise<StyleReferenceInput> {
  const mimeType = file.type.toLowerCase();
  if (!SUPPORTED_STYLE_REFERENCE_TYPES.has(mimeType)) {
    throw new StyleReferenceFileError("unsupported-type");
  }
  if (file.size === 0) {
    throw new StyleReferenceFileError("empty-file");
  }
  if (file.size >= MAX_STYLE_REFERENCE_BYTES) {
    throw new StyleReferenceFileError("too-large");
  }

  const dataUrl = await readAsDataUrl(file);
  const separator = dataUrl.indexOf(",");
  if (separator < 0 || separator === dataUrl.length - 1) {
    throw new StyleReferenceFileError("read-failed");
  }
  const data = dataUrl.slice(separator + 1);

  return {
    entityId: referenceId(),
    name: file.name,
    mimeType,
    contentHash: hashReferenceContent(data, mimeType),
    data,
    strength: 0.5,
  };
}
