import { useCallback, useEffect, useRef, useState } from "react";
import { AudioEngine } from "@/features/audio/audio-engine";
import {
  getCameraPermissionState,
  openCamera,
  stopCamera,
} from "@/features/camera/camera-service";
import type { CameraSession } from "@/features/camera/camera-types";
import { InferenceBridge } from "@/features/inference/inference-bridge";
import {
  clearOverlay,
  drawHandOverlay,
} from "@/features/inference/landmark-utils";
import {
  createEmptyInteractionState,
  type InferenceResultPayload,
  type InteractionState,
} from "@/features/inference/inference-types";
import {
  mapInferenceToInteraction,
  smoothInteractionState,
} from "@/features/gestures/gesture-mapper";
import {
  createInitialSessionSnapshot,
  type SessionSnapshot,
  type SessionStatus,
} from "@/features/session/session-machine";
import type { RuntimePreset } from "@/features/session/runtime-settings";
import { VisualEngine } from "@/features/visual/visual-engine";
import { createEmptyMetrics, type RuntimeMetrics } from "@/shared/events";

function toUserMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 접근을 허용해주세요.";
    }

    if (error.name === "NotFoundError") {
      return "사용 가능한 카메라를 찾지 못했습니다.";
    }

    if (error.name === "NotReadableError") {
      return "다른 앱이 카메라를 점유하고 있습니다. 다른 앱을 종료한 뒤 다시 시도해주세요.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "세션 시작 중 알 수 없는 오류가 발생했습니다.";
}

export function useSessionController(runtimePreset: RuntimePreset) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sceneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [session, setSession] = useState<SessionSnapshot>(
    createInitialSessionSnapshot(),
  );
  const [metrics, setMetrics] = useState<RuntimeMetrics>(createEmptyMetrics());
  const [interaction, setInteraction] = useState<InteractionState>(
    createEmptyInteractionState(),
  );
  const [lastResult, setLastResult] = useState<InferenceResultPayload | null>(
    null,
  );

  const sessionRef = useRef(session);
  const metricsCounterRef = useRef({
    startedAt: performance.now(),
    frames: 0,
  });
  const runtimePresetRef = useRef(runtimePreset);
  const visualEngineRef = useRef<VisualEngine | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const cameraSessionRef = useRef<CameraSession | null>(null);
  const inferenceBridgeRef = useRef<InferenceBridge | null>(null);
  const frameLoopIdRef = useRef<number | null>(null);
  const lastInteractionRef = useRef(createEmptyInteractionState());
  const frameStateRef = useRef({
    lastInferenceAt: 0,
    lastVideoTime: -1,
  });

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    runtimePresetRef.current = runtimePreset;
  }, [runtimePreset]);

  useEffect(() => {
    const canvas = sceneCanvasRef.current;
    if (!canvas) {
      return;
    }

    const visualEngine = new VisualEngine(canvas, (renderFps) => {
      setMetrics((previous) => ({ ...previous, renderFps }));
    });

    visualEngineRef.current = visualEngine;

    return () => {
      visualEngine.dispose();
      visualEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    drawHandOverlay(overlayCanvasRef.current, lastResult, interaction);
  }, [interaction, lastResult]);

  const stopRuntime = useCallback(() => {
    if (frameLoopIdRef.current !== null) {
      cancelAnimationFrame(frameLoopIdRef.current);
      frameLoopIdRef.current = null;
    }

    inferenceBridgeRef.current?.dispose();
    inferenceBridgeRef.current = null;

    stopCamera(cameraSessionRef.current);
    cameraSessionRef.current = null;

    audioEngineRef.current?.dispose();
    audioEngineRef.current = null;

    lastInteractionRef.current = createEmptyInteractionState();
    frameStateRef.current = {
      lastInferenceAt: 0,
      lastVideoTime: -1,
    };

    clearOverlay(overlayCanvasRef.current);
    setInteraction(createEmptyInteractionState());
    setLastResult(null);
    setMetrics((previous) => ({
      ...createEmptyMetrics(),
      renderFps: previous.renderFps,
    }));

    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.pause();
      videoEl.srcObject = null;
    }
  }, []);

  const stopSession = useCallback(
    async (nextStatus: SessionStatus = "idle", errorMessage?: string) => {
      stopRuntime();

      setSession((previous) => ({
        ...previous,
        status: nextStatus,
        errorMessage: errorMessage ?? null,
      }));
    },
    [stopRuntime],
  );

  useEffect(() => {
    return () => {
      void stopSession();
    };
  }, [stopSession]);

  const handleInferenceResult = useCallback((result: InferenceResultPayload) => {
    setLastResult(result);

    const nextInteraction = smoothInteractionState(
      lastInteractionRef.current,
      mapInferenceToInteraction(result, runtimePresetRef.current.calibration),
    );

    lastInteractionRef.current = nextInteraction;
    visualEngineRef.current?.setInteractionState(nextInteraction);
    audioEngineRef.current?.update(nextInteraction);
    setInteraction(nextInteraction);

    metricsCounterRef.current.frames += 1;
    const now = performance.now();
    const elapsed = now - metricsCounterRef.current.startedAt;

    setMetrics((previous) => ({
      ...previous,
      audioReady: Boolean(audioEngineRef.current),
      lastInferenceMs: result.processingMs,
    }));

    if (elapsed >= 1000) {
      const inferenceFps = (metricsCounterRef.current.frames * 1000) / elapsed;
      metricsCounterRef.current.frames = 0;
      metricsCounterRef.current.startedAt = now;

      setMetrics((previous) => ({
        ...previous,
        inferenceFps,
      }));
    }
  }, []);

  const handleInferenceError = useCallback(
    (message: string) => {
      void stopSession("error", message);
    },
    [stopSession],
  );

  const frameLoop = useCallback((timestamp: number) => {
    frameLoopIdRef.current = requestAnimationFrame(frameLoop);

    if (sessionRef.current.status !== "running") {
      return;
    }

    const videoEl = videoRef.current;
    const inferenceBridge = inferenceBridgeRef.current;

    if (!videoEl || !inferenceBridge) {
      return;
    }

    const frameInterval = 1000 / runtimePresetRef.current.targetInferenceFps;
    const hasFreshVideoFrame =
      videoEl.currentTime !== frameStateRef.current.lastVideoTime;
    const hasBudget =
      timestamp - frameStateRef.current.lastInferenceAt >= frameInterval;

    if (!hasFreshVideoFrame || !hasBudget) {
      return;
    }

    void inferenceBridge.processVideoFrame(videoEl, timestamp).then((processed) => {
      if (!processed) {
        return;
      }

      frameStateRef.current.lastInferenceAt = timestamp;
      frameStateRef.current.lastVideoTime = videoEl.currentTime;
    });
  }, []);

  const startSession = useCallback(async () => {
    if (
      sessionRef.current.status === "priming" ||
      sessionRef.current.status === "running"
    ) {
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) {
      return;
    }

    setSession((previous) => ({
      ...previous,
      status: "priming",
      errorMessage: null,
    }));

    try {
      const audioEngine = new AudioEngine();
      const audioStartPromise = audioEngine.start();
      audioEngineRef.current = audioEngine;

      const permissionState = await getCameraPermissionState();
      const cameraSession = await openCamera(videoEl);
      cameraSessionRef.current = cameraSession;

      await audioStartPromise;

      const inferenceBridge = new InferenceBridge({
        onResult: handleInferenceResult,
        onError: handleInferenceError,
      });

      inferenceBridgeRef.current = inferenceBridge;
      await inferenceBridge.init();

      visualEngineRef.current?.setInteractionState(createEmptyInteractionState());

      if (frameLoopIdRef.current !== null) {
        cancelAnimationFrame(frameLoopIdRef.current);
      }

      frameLoopIdRef.current = requestAnimationFrame(frameLoop);
      metricsCounterRef.current = {
        startedAt: performance.now(),
        frames: 0,
      };

      setMetrics((previous) => ({
        ...previous,
        audioReady: true,
      }));
      setSession({
        status: "running",
        permissionState,
        errorMessage: null,
      });
    } catch (error) {
      const message = toUserMessage(error);
      stopRuntime();

      setSession((previous) => ({
        ...previous,
        status: "error",
        errorMessage: message,
        permissionState:
          previous.permissionState === "unknown"
            ? "denied"
            : previous.permissionState,
      }));
    }
  }, [frameLoop, handleInferenceError, handleInferenceResult, stopRuntime]);

  return {
    refs: {
      videoRef,
      sceneCanvasRef,
      overlayCanvasRef,
    },
    session,
    metrics,
    interaction,
    startSession,
    stopSession,
  };
}
