import {
  type InferenceResultPayload,
  type WorkerToMainMessage,
} from "@/features/inference/inference-types";
import {
  GESTURE_RECOGNIZER_MODEL_URL,
  MEDIAPIPE_WASM_BASE_URL,
} from "@/shared/constants";

interface InferenceBridgeOptions {
  onResult: (result: InferenceResultPayload) => void;
  onError: (message: string) => void;
}

export class InferenceBridge {
  private readonly worker: Worker;
  private initialized = false;
  private initializing = false;
  private busy = false;
  private initResolver: (() => void) | null = null;
  private initRejecter: ((reason?: unknown) => void) | null = null;

  constructor(private readonly options: InferenceBridgeOptions) {
    this.worker = new Worker(
      new URL("../../workers/inference.worker.ts", import.meta.url),
      { type: "module" },
    );

    this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const message = event.data;

      switch (message.type) {
        case "INFERENCE_READY":
          this.initialized = true;
          this.initializing = false;
          this.initResolver?.();
          this.initResolver = null;
          this.initRejecter = null;
          break;
        case "INFERENCE_RESULT":
          this.busy = false;
          this.options.onResult(message);
          break;
        case "INFERENCE_ERROR":
          this.busy = false;
          this.initializing = false;
          this.initRejecter?.(new Error(message.message));
          this.initResolver = null;
          this.initRejecter = null;
          this.options.onError(message.message);
          break;
      }
    };
  }

  async init() {
    if (this.initialized) {
      return;
    }

    if (this.initializing) {
      return new Promise<void>((resolve, reject) => {
        this.initResolver = resolve;
        this.initRejecter = reject;
      });
    }

    this.initializing = true;

    return new Promise<void>((resolve, reject) => {
      this.initResolver = resolve;
      this.initRejecter = reject;

      this.worker.postMessage({
        type: "INIT_INFERENCE",
        wasmBaseUrl: MEDIAPIPE_WASM_BASE_URL,
        modelAssetPath: GESTURE_RECOGNIZER_MODEL_URL,
      });
    });
  }

  async processVideoFrame(
    videoEl: HTMLVideoElement,
    timestamp: number,
  ): Promise<boolean> {
    if (
      !this.initialized ||
      this.busy ||
      videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return false;
    }

    const bitmap = await createImageBitmap(videoEl);

    this.busy = true;
    this.worker.postMessage(
      {
        type: "PROCESS_FRAME",
        timestamp,
        width: videoEl.videoWidth,
        height: videoEl.videoHeight,
        bitmap,
      },
      [bitmap],
    );

    return true;
  }

  dispose() {
    this.worker.postMessage({ type: "DISPOSE_INFERENCE" });
    this.worker.terminate();
    this.busy = false;
    this.initialized = false;
    this.initializing = false;
    this.initResolver = null;
    this.initRejecter = null;
  }
}
