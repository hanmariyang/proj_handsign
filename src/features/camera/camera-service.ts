import { DEFAULT_VIDEO_CONSTRAINTS } from "@/shared/constants";
import type {
  CameraPermissionState,
  CameraSession,
} from "@/features/camera/camera-types";

function waitForVideoReady(videoEl: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("카메라 초기화 시간이 초과되었습니다."));
    }, 10_000);

    const onLoadedMetadata = () => {
      cleanup();
      resolve();
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      videoEl.removeEventListener("loadedmetadata", onLoadedMetadata);
    };

    videoEl.addEventListener("loadedmetadata", onLoadedMetadata, {
      once: true,
    });
  });
}

export async function getCameraPermissionState(): Promise<CameraPermissionState> {
  if (!("permissions" in navigator)) {
    return "unknown";
  }

  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });

    return status.state;
  } catch {
    return "unknown";
  }
}

export async function openCamera(
  videoEl: HTMLVideoElement,
): Promise<CameraSession> {
  const stream = await navigator.mediaDevices.getUserMedia(
    DEFAULT_VIDEO_CONSTRAINTS,
  );

  videoEl.srcObject = stream;
  videoEl.autoplay = true;
  videoEl.muted = true;
  videoEl.playsInline = true;

  await waitForVideoReady(videoEl);
  await videoEl.play();

  const [track] = stream.getVideoTracks();
  const settings = track?.getSettings();

  return {
    stream,
    width: settings?.width ?? videoEl.videoWidth,
    height: settings?.height ?? videoEl.videoHeight,
    deviceId: settings?.deviceId,
  };
}

export function stopCamera(cameraSession: CameraSession | null) {
  if (!cameraSession) {
    return;
  }

  cameraSession.stream.getTracks().forEach((track) => track.stop());
}
