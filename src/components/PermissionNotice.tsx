import type { CameraPermissionState } from "@/features/camera/camera-types";

interface PermissionNoticeProps {
  permissionState: CameraPermissionState;
  errorMessage: string | null;
  runtimeHint: string;
}

export function PermissionNotice({
  permissionState,
  errorMessage,
  runtimeHint,
}: PermissionNoticeProps) {
  const label = permissionState === "denied"
    ? "Camera blocked"
    : permissionState === "granted"
      ? "Camera granted"
      : "Camera permission";

  return (
    <div className="permission-notice">
      <span className="permission-label">{label}</span>
      <p>
        {errorMessage ??
          `${runtimeHint}. 첫 클릭 이후에만 카메라와 오디오를 켜고, 프레임은 브라우저 안에서만 처리합니다.`}
      </p>
    </div>
  );
}
