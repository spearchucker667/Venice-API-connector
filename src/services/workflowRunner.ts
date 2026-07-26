import { translateRuntime } from "../i18n/runtimeTranslator";
import {
  type WorkflowCompileResult,
  type WorkflowCompileWarning,
} from "./workflowCompiler";
import { type WorkflowStepTarget } from "../types/workflow";
import { type TabId } from "../config/tabs";

export type WorkflowRunActionKind =
  | "open_tab"
  | "handoff_prompt"
  | "handoff_image_recipe"
  | "handoff_scene"
  | "select_media"
  | "open_rp_context"
  | "show_note";

export interface WorkflowRunAction {
  id: string;
  kind: WorkflowRunActionKind;
  target: WorkflowStepTarget;
  tabId?: TabId;
  label: string;
  payload?: Record<string, unknown>;
  outputKey?: string;
}

export interface WorkflowRunPlan {
  workflowId: string;
  versionId: string;
  actions: WorkflowRunAction[];
  outputs: Record<string, Record<string, unknown>>;
  warnings: WorkflowCompileWarning[];
}

const TARGET_TAB_IDS = {
  chat: "chat",
  image_studio: "image",
  media_studio: "media",
  research: "search",
  scene_composer: "scenes",
  rp_studio: "rp-studio",
  none: undefined,
} as const satisfies Record<WorkflowStepTarget, TabId | undefined>;

export function getWorkflowTargetTabId(
  target: WorkflowStepTarget,
): TabId | undefined {
  return TARGET_TAB_IDS[target];
}

export function createWorkflowRunPlan(
  compiled: WorkflowCompileResult,
): WorkflowRunPlan {
  const plan: WorkflowRunPlan = {
    workflowId: compiled.workflowId,
    versionId: compiled.versionId,
    actions: [],
    outputs: {},
    warnings: [...compiled.warnings],
  };

  if (!compiled.canRun) {
    return plan;
  }

  for (const step of compiled.steps) {
    plan.warnings.push(...step.warnings);

    const tabId = getWorkflowTargetTabId(step.target);

    if (step.outputKey) {
      if (Object.hasOwn(plan.outputs, step.outputKey)) {
        plan.warnings.push({
          id: `duplicate-output-key:${step.outputKey}`,
          severity: "warning",
          message: translateRuntime(
            "runtimeGenerated.services.workflowrunner.metadata.duplicateOutputKeyValue1UsesTheLastStepValueAll",
            "Duplicate output key '{{value1}}' uses the last step value; all actions will still run.",
            { value1: step.outputKey },
          ),
        });
      }
      plan.outputs[step.outputKey] = { ...step.resolvedInput };
    }

    if (step.kind === "prompt") {
      plan.actions.push({
        id: step.id,
        kind: "handoff_prompt",
        target: step.target,
        tabId,
        label: translateRuntime(
          "runtimeGenerated.services.workflowrunner.metadata.sendPromptToValue1",
          "Send prompt to {{value1}}",
          { value1: step.target },
        ),
        payload: { ...step.resolvedInput },
        outputKey: step.outputKey,
      });
    } else if (step.kind === "image_recipe") {
      plan.actions.push({
        id: step.id,
        kind: "handoff_image_recipe",
        target: step.target,
        tabId,
        label: translateRuntime(
          "runtimeGenerated.services.workflowrunner.metadata.sendRecipeToValue1",
          "Send recipe to {{value1}}",
          { value1: step.target },
        ),
        payload: { ...step.resolvedInput },
        outputKey: step.outputKey,
      });
    } else if (step.kind === "scene") {
      plan.actions.push({
        id: step.id,
        kind: "handoff_scene",
        target: step.target,
        tabId,
        label: translateRuntime(
          "runtimeGenerated.services.workflowrunner.metadata.sendSceneToValue1",
          "Send scene to {{value1}}",
          { value1: step.target },
        ),
        payload: { ...step.resolvedInput },
        outputKey: step.outputKey,
      });
    } else if (step.kind === "media") {
      plan.actions.push({
        id: step.id,
        kind: "select_media",
        target: step.target,
        tabId,
        label: translateRuntime(
          "runtimeGenerated.services.workflowrunner.metadata.selectMedia",
          "Select media",
        ),
        payload: { ...step.resolvedInput },
        outputKey: step.outputKey,
      });
    } else if (step.kind === "rp_character" || step.kind === "rp_scenario") {
      plan.actions.push({
        id: step.id,
        kind: "open_rp_context",
        target: step.target,
        tabId,
        label: translateRuntime(
          "runtimeGenerated.services.workflowrunner.metadata.openRpContext",
          "Open RP context",
        ),
        payload: { ...step.resolvedInput },
        outputKey: step.outputKey,
      });
    } else if (step.kind === "note") {
      plan.actions.push({
        id: step.id,
        kind: "show_note",
        target: step.target,
        tabId,
        label: translateRuntime(
          "runtimeGenerated.services.workflowrunner.metadata.showNote",
          "Show note",
        ),
        payload: { ...step.resolvedInput },
        outputKey: step.outputKey,
      });
    } else {
      plan.actions.push({
        id: step.id,
        kind: "open_tab",
        target: step.target,
        tabId,
        label: translateRuntime(
          "runtimeGenerated.services.workflowrunner.metadata.openValue1",
          "Open {{value1}}",
          { value1: step.target },
        ),
        payload: { ...step.resolvedInput },
        outputKey: step.outputKey,
      });
    }
  }

  return plan;
}
