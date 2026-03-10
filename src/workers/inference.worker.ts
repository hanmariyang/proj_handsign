/// <reference lib="webworker" />

import type {
  InferenceResultPayload,
  MainToWorkerMessage,
  RecognitionCategory,
} from "@/features/inference/inference-types";

interface LandmarkLike {
  x: number;
  y: number;
  z: number;
}

interface RecognitionLike {
  landmarks: LandmarkLike[][];
  gestures: RecognitionCategory[][];
  handedness: RecognitionCategory[][];
}

interface GestureRecognizerLike {
  recognizeForVideo(input: ImageBitmap, timestamp: number): RecognitionLike;
  close(): void;
}

interface MediaPipeVisionModule {
  FilesetResolver: {
    forVisionTasks(basePath: string): Promise<unknown>;
  };
  GestureRecognizer: {
    createFromOptions(
      vision: unknown,
      options: Record<string, unknown>,
    ): Promise<GestureRecognizerLike>;
  };
}

let recognizer: GestureRecognizerLike | null = null;
let mediaPipeModulePromise: Promise<MediaPipeVisionModule> | null = null;

async function loadMediaPipeModule() {
  if (!mediaPipeModulePromise) {
    const moduleUrl =
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/vision_bundle.mjs";
    const dynamicImport = new Function("url", "return import(url)");
    mediaPipeModulePromise = dynamicImport(moduleUrl) as Promise<
      MediaPipeVisionModule
    >;
  }

  return mediaPipeModulePromise;
}

function categoriesToPayload(
  categories: Array<{ categoryName: string; score: number }> | undefined,
): RecognitionCategory[] {
  return (categories ?? []).map((category) => ({
    categoryName: category.categoryName,
    score: category.score,
  }));
}

async function initInference(wasmBaseUrl: string, modelAssetPath: string) {
  const mediaPipe = await loadMediaPipeModule();
  const vision = await mediaPipe.FilesetResolver.forVisionTasks(wasmBaseUrl);

  recognizer = await mediaPipe.GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.5,
    cannedGesturesClassifierOptions: {
      scoreThreshold: 0.45,
      maxResults: 1,
    },
  });
}

function postError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown inference error";
  self.postMessage({
    type: "INFERENCE_ERROR",
    message,
  });
}

self.onmessage = async (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case "INIT_INFERENCE":
        await initInference(message.wasmBaseUrl, message.modelAssetPath);
        self.postMessage({ type: "INFERENCE_READY" });
        break;
      case "PROCESS_FRAME": {
        if (!recognizer) {
          throw new Error("Gesture recognizer is not ready.");
        }

        const startedAt = performance.now();
        const recognition = recognizer.recognizeForVideo(
          message.bitmap,
          message.timestamp,
        );
        message.bitmap.close();

        const payload: InferenceResultPayload = {
          type: "INFERENCE_RESULT",
          timestamp: message.timestamp,
          processingMs: performance.now() - startedAt,
          landmarks: recognition.landmarks.map((hand) =>
            hand.map((point) => ({
              x: point.x,
              y: point.y,
              z: point.z,
            }))
          ),
          gestures: recognition.gestures.map((gestureList) =>
            categoriesToPayload(gestureList)
          ),
          handedness: recognition.handedness.map((handednessList) =>
            categoriesToPayload(handednessList)
          ),
        };

        self.postMessage(payload);
        break;
      }
      case "DISPOSE_INFERENCE":
        recognizer?.close();
        recognizer = null;
        break;
    }
  } catch (error) {
    if (message.type === "PROCESS_FRAME") {
      message.bitmap.close();
    }
    postError(error);
  }
};
