import {
  createEmptyInteractionState,
  type InferenceResultPayload,
  type InteractionState,
  type LandmarkPoint,
  type SceneMode,
} from "@/features/inference/inference-types";
import {
  averageLandmarks,
  calculatePinchDistance,
} from "@/features/inference/landmark-utils";
import type { GestureCalibration } from "@/features/gestures/gesture-thresholds";
import { clamp, lerp } from "@/shared/math";

function mirrorPoint(point: LandmarkPoint | null): LandmarkPoint | null {
  if (!point) {
    return null;
  }

  return {
    ...point,
    x: 1 - point.x,
  };
}

function normalizeGestureLabel(
  categoryName: string | undefined,
  score: number | undefined,
  confidenceThreshold: number,
) {
  if (!categoryName || categoryName === "None") {
    return null;
  }

  if ((score ?? 0) < confidenceThreshold) {
    return null;
  }

  return categoryName;
}

function deriveSceneMode(
  gestureLabel: string | null,
  pinch: number,
  pinchEngagedThreshold: number,
): SceneMode {
  if (gestureLabel === "Victory") {
    return "victory-flare";
  }

  if (gestureLabel === "Open_Palm") {
    return "open-palm";
  }

  if (pinch >= pinchEngagedThreshold) {
    return "pinch-focus";
  }

  return "tracking";
}

export function mapInferenceToInteraction(
  result: InferenceResultPayload | null,
  calibration: GestureCalibration,
): InteractionState {
  if (!result?.landmarks.length) {
    return createEmptyInteractionState();
  }

  const landmarks = result.landmarks[0];
  const pinchDistance = calculatePinchDistance(landmarks[4], landmarks[8]);
  const palmCenter = averageLandmarks(landmarks, [0, 5, 9, 13, 17]);
  const primaryGesture = result.gestures[0]?.[0];
  const gestureLabel = normalizeGestureLabel(
    primaryGesture?.categoryName,
    primaryGesture?.score,
    calibration.gestureConfidenceThreshold,
  );
  const handedness = result.handedness[0]?.[0]?.categoryName ?? null;
  const pinch = 1 -
    clamp(
      (pinchDistance - calibration.pinchActiveDistance) /
        (calibration.pinchReleaseDistance - calibration.pinchActiveDistance),
      0,
      1,
    );
  const sceneMode = deriveSceneMode(
    gestureLabel,
    pinch,
    calibration.pinchEngagedThreshold,
  );
  const presence = clamp(0.45 + pinch * 0.55, 0, 1);

  return {
    handDetected: true,
    gestureLabel,
    gestureConfidence: primaryGesture?.score ?? 0,
    pinch,
    isPinching: pinch >= calibration.pinchEngagedThreshold,
    presence,
    sceneMode,
    palmCenter: mirrorPoint(palmCenter),
    pointer: mirrorPoint(landmarks[8] ?? palmCenter),
    handedness,
    landmarkCount: landmarks.length,
    timestamp: result.timestamp,
  };
}

export function smoothInteractionState(
  previous: InteractionState,
  next: InteractionState,
): InteractionState {
  if (!next.handDetected || !previous.handDetected) {
    return next;
  }

  const smoothPoint = (
    previousPoint: LandmarkPoint | null,
    nextPoint: LandmarkPoint | null,
  ) => {
    if (!previousPoint || !nextPoint) {
      return nextPoint;
    }

    return {
      x: lerp(previousPoint.x, nextPoint.x, 0.28),
      y: lerp(previousPoint.y, nextPoint.y, 0.28),
      z: lerp(previousPoint.z, nextPoint.z, 0.28),
    };
  };

  return {
    ...next,
    pinch: lerp(previous.pinch, next.pinch, 0.32),
    presence: lerp(previous.presence, next.presence, 0.3),
    palmCenter: smoothPoint(previous.palmCenter, next.palmCenter),
    pointer: smoothPoint(previous.pointer, next.pointer),
  };
}
