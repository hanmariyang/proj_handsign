import type { CameraPermissionState } from "@/features/camera/camera-types";

export type SessionStatus = "idle" | "priming" | "running" | "paused" | "error";

export interface SessionSnapshot {
  status: SessionStatus;
  permissionState: CameraPermissionState;
  errorMessage: string | null;
}

export function createInitialSessionSnapshot(): SessionSnapshot {
  return {
    status: "idle",
    permissionState: "unknown",
    errorMessage: null,
  };
}
