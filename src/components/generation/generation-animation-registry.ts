import idleGif from "../../../assets/mascot/mio-xc3-nerdprofeta-idle.gif";
import idleStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-idle-static.png";
import waitingGif from "../../../assets/mascot/mio-xc3-nerdprofeta-waiting.gif";
import waitingStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-waiting-static.png";
import runningGif from "../../../assets/mascot/mio-xc3-nerdprofeta-running.gif";
import runningStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-running-static.png";
import runningLeftGif from "../../../assets/mascot/mio-xc3-nerdprofeta-running-left.gif";
import runningLeftStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-running-left-static.png";
import runningRightGif from "../../../assets/mascot/mio-xc3-nerdprofeta-running-right.gif";
import runningRightStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-running-right-static.png";
import jumpingGif from "../../../assets/mascot/mio-xc3-nerdprofeta-jumping.gif";
import jumpingStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-jumping-static.png";
import reviewGif from "../../../assets/mascot/mio-xc3-nerdprofeta-review.gif";
import reviewStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-review-static.png";
import lookLeftGif from "../../../assets/mascot/mio-xc3-nerdprofeta-look-left-side.gif";
import lookLeftStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-look-left-side-static.png";
import lookRightGif from "../../../assets/mascot/mio-xc3-nerdprofeta-look-right-side.gif";
import lookRightStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-look-right-side-static.png";
import wavingGif from "../../../assets/mascot/mio-xc3-nerdprofeta-waving.gif";
import wavingStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-waving-static.png";
import failedGif from "../../../assets/mascot/mio-xc3-nerdprofeta-failed.gif";
import failedStatic from "../../../assets/mascot/mio-xc3-nerdprofeta-failed-static.png";
import type { AnimationSemanticGroup } from "./generation-animation-state";

export interface AnimationAsset {
  id: string;
  src: string;
  staticSrc: string;
  nominalLoopMs: number;
}

export const animationAssets: Record<string, AnimationAsset> = {
  idle: { id: "idle", src: idleGif, staticSrc: idleStatic, nominalLoopMs: 1440 },
  waiting: { id: "waiting", src: waitingGif, staticSrc: waitingStatic, nominalLoopMs: 1440 },
  running: { id: "running", src: runningGif, staticSrc: runningStatic, nominalLoopMs: 1440 },
  runningLeft: { id: "runningLeft", src: runningLeftGif, staticSrc: runningLeftStatic, nominalLoopMs: 1440 },
  runningRight: { id: "runningRight", src: runningRightGif, staticSrc: runningRightStatic, nominalLoopMs: 1440 },
  jumping: { id: "jumping", src: jumpingGif, staticSrc: jumpingStatic, nominalLoopMs: 1000 },
  review: { id: "review", src: reviewGif, staticSrc: reviewStatic, nominalLoopMs: 1440 },
  lookLeft: { id: "lookLeft", src: lookLeftGif, staticSrc: lookLeftStatic, nominalLoopMs: 1440 },
  lookRight: { id: "lookRight", src: lookRightGif, staticSrc: lookRightStatic, nominalLoopMs: 1440 },
  waving: { id: "waving", src: wavingGif, staticSrc: wavingStatic, nominalLoopMs: 1000 },
  failed: { id: "failed", src: failedGif, staticSrc: failedStatic, nominalLoopMs: 1440 },
};

export const generationAnimationRegistry: Record<AnimationSemanticGroup, AnimationAsset[]> = {
  queued: [animationAssets.waiting, animationAssets.idle, animationAssets.lookLeft, animationAssets.lookRight],
  active: [animationAssets.running, animationAssets.runningLeft, animationAssets.runningRight, animationAssets.jumping],
  processing: [animationAssets.review, animationAssets.lookLeft, animationAssets.lookRight, animationAssets.idle],
  completed: [animationAssets.waving],
  failed: [animationAssets.failed],
  neutral: [animationAssets.idle],
};

export function getAnimationsForGroup(group: AnimationSemanticGroup): AnimationAsset[] {
  return generationAnimationRegistry[group] || generationAnimationRegistry.neutral;
}
