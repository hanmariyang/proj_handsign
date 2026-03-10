export type CameraPermissionState = PermissionState | "unknown";

export interface CameraSession {
  stream: MediaStream;
  width: number;
  height: number;
  deviceId?: string;
}
