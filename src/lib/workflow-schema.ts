import { translateRuntime } from "../i18n/runtimeTranslator";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MUSIC_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_VIDEO_MODEL,
  DEFAULT_WORKFLOW_MODEL,
} from "../constants/venice";
import type { VeniceNodeType } from "../stores/workflow-store";

export type IOKind = "text" | "image" | "audio" | "video" | "none";

export type ParamType = "string" | "text" | "number" | "boolean" | "enum";

export interface ParamSchema {
  name: string;
  type: ParamType;
  description: string;
  required?: boolean;
  default?: string | number | boolean;
  enumValues?: readonly string[];
  min?: number;
  max?: number;
}

export interface NodeSchema {
  type: VeniceNodeType;
  label: string;
  description: string;
  input: IOKind;
  output: IOKind;
  params: readonly ParamSchema[];
}

const WEB_SEARCH_VALUES = ["off", "on", "auto"] as const;
const VIDEO_ASPECT_VALUES = ["16:9", "9:16", "1:1", "4:3", "3:4"] as const;
// QueueVideoRequest requires `duration` (no "model default" empty option).
const VIDEO_DURATION_VALUES = ["5s", "10s"] as const;
const VIDEO_RESOLUTION_VALUES = ["", "720p", "1080p"] as const;
const TTS_FORMAT_VALUES = ["mp3", "opus", "aac", "flac", "wav"] as const;

export const NODE_SCHEMAS: Record<VeniceNodeType, NodeSchema> = {
  textInput: {
    type: "textInput",
    get label() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.input",
        "Input",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.staticTextProvidedByTheUserStartingPointOfA",
        "Static text provided by the user. Starting point of a workflow.",
      );
    },
    input: "none",
    output: "text",
    params: [
      {
        name: "inputText",
        type: "text",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.theTextValue",
            "The text value.",
          );
        },
        required: true,
        default: "",
      },
    ],
  },
  output: {
    type: "output",
    get label() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.output",
        "Output",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.displaysWhateverItsUpstreamNodeProducedAcceptsAnyKind",
        "Displays whatever its upstream node produced. Accepts any kind.",
      );
    },
    input: "text",
    output: "none",
    params: [],
  },
  chat: {
    type: "chat",
    get label() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.llm",
        "LLM",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.runAVeniceChatCompletionAcceptsUpstreamTextAsContext",
        "Run a Venice chat completion. Accepts upstream text as context.",
      );
    },
    input: "text",
    output: "text",
    params: [
      {
        name: "model",
        type: "string",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.veniceChatModelId",
            "Venice chat model id.",
          );
        },
        required: true,
        default: DEFAULT_WORKFLOW_MODEL,
      },
      {
        name: "prompt",
        type: "text",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.instructionUseInputToPositionUpstreamTextOrLeaveEmpty",
            "Instruction. Use {{input}} to position upstream text, or leave empty to append.",
          );
        },
        required: true,
        default: "",
      },
      {
        name: "temperature",
        type: "number",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.samplingTemperature",
            "Sampling temperature.",
          );
        },
        default: 0.7,
        min: 0,
        max: 2,
      },
      {
        name: "maxTokens",
        type: "number",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.maxOutputTokens",
            "Max output tokens.",
          );
        },
        default: 4096,
        min: 64,
        max: 32768,
      },
      {
        name: "webSearch",
        type: "enum",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.enableVeniceWebSearch",
            "Enable Venice web search.",
          );
        },
        default: "off",
        enumValues: WEB_SEARCH_VALUES,
      },
    ],
  },
  imageGen: {
    type: "imageGen",
    get label() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.imageGen",
        "Image Gen",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.generateAnImageFromATextPrompt",
        "Generate an image from a text prompt.",
      );
    },
    input: "text",
    output: "image",
    params: [
      {
        name: "model",
        type: "string",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.veniceImageModelId",
            "Venice image model id.",
          );
        },
        required: true,
        default: DEFAULT_IMAGE_MODEL,
      },
      {
        name: "prompt",
        type: "text",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.imagePromptUseInputToPositionUpstreamText",
            "Image prompt. Use {{input}} to position upstream text.",
          );
        },
        required: true,
        default: "",
      },
      {
        name: "negativePrompt",
        type: "string",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.whatToAvoid",
            "What to avoid.",
          );
        },
        default: "",
      },
      {
        name: "steps",
        type: "number",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.denoisingSteps",
            "Denoising steps.",
          );
        },
        default: 20,
        min: 1,
        max: 50,
      },
      {
        name: "width",
        type: "number",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.imageWidthInPixels",
            "Image width in pixels.",
          );
        },
        default: 1024,
        min: 256,
        max: 2048,
      },
      {
        name: "height",
        type: "number",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.imageHeightInPixels",
            "Image height in pixels.",
          );
        },
        default: 1024,
        min: 256,
        max: 2048,
      },
      {
        name: "style",
        type: "string",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.stylePresetName",
            "Style preset name.",
          );
        },
        default: "",
      },
      {
        name: "hideWatermark",
        type: "boolean",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.omitWatermarkIfAllowed",
            "Omit watermark if allowed.",
          );
        },
        default: true,
      },
    ],
  },
  tts: {
    type: "tts",
    get label() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.textToSpeech",
        "Text to Speech",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.narrateTextIntoSpeechAudio",
        "Narrate text into speech audio.",
      );
    },
    input: "text",
    output: "audio",
    params: [
      {
        name: "model",
        type: "string",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.ttsModelId",
            "TTS model id.",
          );
        },
        required: true,
        default: DEFAULT_TTS_MODEL,
      },
      {
        name: "prompt",
        type: "text",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.textToSpeakUseInputToPositionUpstreamText",
            "Text to speak. Use {{input}} to position upstream text.",
          );
        },
        default: "",
      },
      {
        name: "voice",
        type: "string",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.voiceId",
            "Voice id.",
          );
        },
        default: "af_sky",
      },
      {
        name: "speed",
        type: "number",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.playbackSpeed",
            "Playback speed.",
          );
        },
        default: 1,
        min: 0.25,
        max: 4,
      },
      {
        name: "responseFormat",
        type: "enum",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.audioFormat",
            "Audio format.",
          );
        },
        default: "mp3",
        enumValues: TTS_FORMAT_VALUES,
      },
    ],
  },
  music: {
    type: "music",
    get label() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.musicGen",
        "Music Gen",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.generateAMusicClipFromATextPrompt",
        "Generate a music clip from a text prompt.",
      );
    },
    input: "text",
    output: "audio",
    params: [
      {
        name: "model",
        type: "string",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.musicModelId",
            "Music model id.",
          );
        },
        required: true,
        default: DEFAULT_MUSIC_MODEL,
      },
      {
        name: "prompt",
        type: "text",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.musicPrompt",
            "Music prompt.",
          );
        },
        required: true,
        default: "",
      },
      {
        name: "duration",
        type: "number",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.durationInSeconds",
            "Duration in seconds.",
          );
        },
        default: 30,
        min: 5,
        max: 120,
      },
      {
        name: "instrumental",
        type: "boolean",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.forceInstrumental",
            "Force instrumental.",
          );
        },
        default: false,
      },
      {
        name: "lyrics",
        type: "text",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.optionalLyrics",
            "Optional lyrics.",
          );
        },
        default: "",
      },
    ],
  },
  video: {
    type: "video",
    get label() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.videoGen",
        "Video Gen",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.lib.workflowSchema.metadata.generateAShortVideoFromATextPrompt",
        "Generate a short video from a text prompt.",
      );
    },
    input: "text",
    output: "video",
    params: [
      {
        name: "model",
        type: "string",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.videoModelId",
            "Video model id.",
          );
        },
        required: true,
        default: DEFAULT_VIDEO_MODEL,
      },
      {
        name: "prompt",
        type: "text",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.videoPrompt",
            "Video prompt.",
          );
        },
        required: true,
        default: "",
      },
      {
        name: "videoAspectRatio",
        type: "enum",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.aspectRatio",
            "Aspect ratio.",
          );
        },
        default: "16:9",
        enumValues: VIDEO_ASPECT_VALUES,
      },
      {
        name: "videoDuration",
        type: "enum",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.clipDuration",
            "Clip duration. Required by the Venice video queue contract.",
          );
        },
        required: true,
        default: "5s",
        enumValues: VIDEO_DURATION_VALUES,
      },
      {
        name: "videoResolution",
        type: "enum",
        get description() {
          return translateRuntime(
            "runtimeGenerated.lib.workflowSchema.metadata.resolutionEmptyMeansModelDefault",
            "Resolution. Empty means model default.",
          );
        },
        default: "",
        enumValues: VIDEO_RESOLUTION_VALUES,
      },
    ],
  },
};

export const NODE_TYPES: readonly VeniceNodeType[] = Object.keys(
  NODE_SCHEMAS,
) as VeniceNodeType[];

export function getNodeSchema(type: VeniceNodeType): NodeSchema {
  return NODE_SCHEMAS[type];
}

export function isInputCompatible(
  sourceOutput: IOKind,
  targetInput: IOKind,
): boolean {
  return sourceOutput !== "none" && targetInput !== "none";
}

export function isIdealMatch(
  sourceOutput: IOKind,
  targetInput: IOKind,
): boolean {
  if (sourceOutput === "none" || targetInput === "none") return false;
  if (targetInput === "text") return true;
  return sourceOutput === targetInput;
}
