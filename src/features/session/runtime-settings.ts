import {
  DESKTOP_STAGE_CALIBRATION,
  LOW_LIGHT_CALIBRATION,
  SAFARI_SAFE_CALIBRATION,
  type GestureCalibration,
} from "@/features/gestures/gesture-thresholds";

export type RuntimePresetId =
  | "desktop-stage"
  | "safari-safe"
  | "low-light";

export interface RuntimePreset {
  id: RuntimePresetId;
  label: string;
  description: string;
  runtimeHint: string;
  targetInferenceFps: number;
  calibration: GestureCalibration;
}

export const RUNTIME_PRESETS: RuntimePreset[] = [
  {
    id: "desktop-stage",
    label: "Desktop Stage",
    description: "Chrome 데스크톱 기준 기본값",
    runtimeHint: "밝은 실내, 데스크톱 Chrome, 24fps 추론",
    targetInferenceFps: 24,
    calibration: DESKTOP_STAGE_CALIBRATION,
  },
  {
    id: "safari-safe",
    label: "Safari Safe",
    description: "보수적 임계값과 낮은 추론 빈도",
    runtimeHint: "Safari 또는 저성능 기기, 18fps 추론",
    targetInferenceFps: 18,
    calibration: SAFARI_SAFE_CALIBRATION,
  },
  {
    id: "low-light",
    label: "Low Light",
    description: "어두운 조명에서 오인식 방지용",
    runtimeHint: "저조도 환경, 더 넓은 pinch 범위, 16fps 추론",
    targetInferenceFps: 16,
    calibration: LOW_LIGHT_CALIBRATION,
  },
];

export const DEFAULT_RUNTIME_PRESET = RUNTIME_PRESETS[0];
