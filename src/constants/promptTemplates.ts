import { translateRuntime } from "../i18n/runtimeTranslator";
/**
 * @fileoverview Prompt templates library for enhancing image and video generation prompts.
 */

export interface PromptTemplate {
  id: string;
  label: string;
  description: string;
  category:
    "lighting" | "composition" | "character" | "style" | "quality" | "negative";
  positiveText?: string;
  negativeText?: string;
  compatibleModes: Array<"image" | "image-edit" | "image-to-video" | "video">;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // Style
  {
    id: "style-anime",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.animeIllustration",
        "Anime Illustration",
      );
    },
    description: "Vibrant colors, clean lineart, modern anime/manga aesthetic",
    category: "style",
    positiveText:
      ", anime illustration, vibrant colors, detailed lineart, clean studio work, high resolution",
    compatibleModes: ["image", "image-edit"],
  },
  {
    id: "style-cinematic",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.cinematicFilm",
        "Cinematic Film",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.value35mmCameraFilmLookNaturalLightingMovieSceneGrain",
        "35mm camera film look, natural lighting, movie scene grain",
      );
    },
    category: "style",
    positiveText:
      ", cinematic style, shot on 35mm film, volumetric lighting, photorealistic details, grain, 8k",
    compatibleModes: ["image", "image-edit", "video"],
  },
  {
    id: "style-vector",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.minimalistVectorArt",
        "Minimalist Vector Art",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.cleanFlatColorVectorDesignSvgStyle",
        "Clean flat color vector design, SVG style",
      );
    },
    category: "style",
    positiveText:
      ", flat vector art, minimalist svg illustration, clean shapes, corporate design style, no gradients",
    compatibleModes: ["image"],
  },
  {
    id: "style-oil",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.oilPainting",
        "Oil Painting",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.classicalTexturedCanvasBrushstrokes",
        "Classical textured canvas brushstrokes",
      );
    },
    category: "style",
    positiveText:
      ", classical oil painting, textured canvas, visible paint brushstrokes, masterpiece, dramatic lighting",
    compatibleModes: ["image", "image-edit"],
  },

  // Lighting
  {
    id: "light-golden",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.goldenHour",
        "Golden Hour",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.warmLowAngleSunsetGlow",
        "Warm, low-angle sunset glow",
      );
    },
    category: "lighting",
    positiveText:
      ", golden hour lighting, warm sunlight, long soft shadows, volumetric dust particles",
    compatibleModes: ["image", "image-edit", "video"],
  },
  {
    id: "light-studio",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.studioPortrait",
        "Studio Portrait",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.professionalMultiPointStudioKeyLighting",
        "Professional multi-point studio key lighting",
      );
    },
    category: "lighting",
    positiveText:
      ", professional studio lighting, three-point key light, soft fill light, dark background, premium headshot quality",
    compatibleModes: ["image", "image-edit"],
  },
  {
    id: "light-neon",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.neonCyberpunk",
        "Neon Cyberpunk",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.vibrantNeonBluesAndMagentasWithDarkShadows",
        "Vibrant neon blues and magentas with dark shadows",
      );
    },
    category: "lighting",
    positiveText:
      ", neon cyberpunk lighting, ambient blue and pink glow, glowing rain-slicked city streets, high contrast",
    compatibleModes: ["image", "image-edit", "video"],
  },

  // Composition
  {
    id: "comp-closeup",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.extremeCloseUp",
        "Extreme Close-Up",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.tightFocusOnFacialDetailsOrSmallSubjects",
        "Tight focus on facial details or small subjects",
      );
    },
    category: "composition",
    positiveText:
      ", extreme close-up shot, shallow depth of field, macro focus, high detail textures",
    compatibleModes: ["image", "image-edit"],
  },
  {
    id: "comp-drone",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.aerialDroneView",
        "Aerial Drone View",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.highAltitudeBirdSEyePerspective",
        "High altitude bird's-eye perspective",
      );
    },
    category: "composition",
    positiveText:
      ", aerial drone shot, bird's-eye view, wide perspective landscape, high altitude composition",
    compatibleModes: ["image", "video"],
  },
  {
    id: "comp-thirds",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.ruleOfThirdsWide",
        "Rule of Thirds Wide",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.balancedOffCenterCinematicFocalPoint",
        "Balanced off-center cinematic focal point",
      );
    },
    category: "composition",
    positiveText:
      ", wide angle landscape, rule of thirds composition, off-center subject, cinematic landscape balance",
    compatibleModes: ["image", "video"],
  },

  // Quality
  {
    id: "qual-photoreal",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.photorealistic8k",
        "Photorealistic 8k",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.maximizesResolutionSkinTexturesAndMaterialRealism",
        "Maximizes resolution, skin textures, and material realism",
      );
    },
    category: "quality",
    positiveText:
      ", photorealistic, hyper-detailed, 8k resolution, raw photo, intricate textures, masterpiece quality",
    compatibleModes: ["image", "image-edit"],
  },

  // Negative
  {
    id: "neg-standard",
    get label() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.standardNegative",
        "Standard Negative",
      );
    },
    get description() {
      return translateRuntime(
        "runtimeGenerated.constants.prompttemplates.metadata.standardPromptsToAvoidDistortionsAndLowQuality",
        "Standard prompts to avoid distortions and low quality",
      );
    },
    category: "negative",
    negativeText:
      "blurry, low quality, distorted, extra limbs, bad proportions, watermark, signature, text, out of frame",
    compatibleModes: ["image", "image-edit", "video"],
  },
];
