export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface RecognitionCategory {
  categoryName: string;
  score: number;
}

export type SceneMode =
  | "idle"
  | "tracking"
  | "open-palm"
  | "pinch-focus"
  | "victory-flare";

export interface InferenceResultPayload {
  type: "INFERENCE_RESULT";
  timestamp: number;
  processingMs: number;
  landmarks: LandmarkPoint[][];
  gestures: RecognitionCategory[][];
  handedness: RecognitionCategory[][];
}

export interface InferenceReadyPayload {
  type: "INFERENCE_READY";
}

export interface InferenceErrorPayload {
  type: "INFERENCE_ERROR";
  message: string;
}

export type WorkerToMainMessage =
  | InferenceReadyPayload
  | InferenceResultPayload
  | InferenceErrorPayload;

export interface InitInferenceMessage {
  type: "INIT_INFERENCE";
  wasmBaseUrl: string;
  modelAssetPath: string;
}

export interface ProcessFrameMessage {
  type: "PROCESS_FRAME";
  timestamp: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}

export interface DisposeInferenceMessage {
  type: "DISPOSE_INFERENCE";
}

export type MainToWorkerMessage =
  | InitInferenceMessage
  | ProcessFrameMessage
  | DisposeInferenceMessage;

export interface InteractionState {
  handDetected: boolean;
  gestureLabel: string | null;
  gestureConfidence: number;
  pinch: number;
  isPinching: boolean;
  presence: number;
  sceneMode: SceneMode;
  palmCenter: LandmarkPoint | null;
  pointer: LandmarkPoint | null;
  handedness: string | null;
  landmarkCount: number;
  timestamp: number;
}

export function createEmptyInteractionState(): InteractionState {
  return {
    handDetected: false,
    gestureLabel: null,
    gestureConfidence: 0,
    pinch: 0,
    isPinching: false,
    presence: 0,
    sceneMode: "idle",
    palmCenter: null,
    pointer: null,
    handedness: null,
    landmarkCount: 0,
    timestamp: 0,
  };
}
