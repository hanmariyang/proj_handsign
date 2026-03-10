export interface GestureCalibration {
  pinchActiveDistance: number;
  pinchReleaseDistance: number;
  pinchEngagedThreshold: number;
  gestureConfidenceThreshold: number;
}

export const DESKTOP_STAGE_CALIBRATION: GestureCalibration = {
  pinchActiveDistance: 0.035,
  pinchReleaseDistance: 0.12,
  pinchEngagedThreshold: 0.58,
  gestureConfidenceThreshold: 0.45,
};

export const SAFARI_SAFE_CALIBRATION: GestureCalibration = {
  pinchActiveDistance: 0.04,
  pinchReleaseDistance: 0.135,
  pinchEngagedThreshold: 0.6,
  gestureConfidenceThreshold: 0.5,
};

export const LOW_LIGHT_CALIBRATION: GestureCalibration = {
  pinchActiveDistance: 0.045,
  pinchReleaseDistance: 0.15,
  pinchEngagedThreshold: 0.62,
  gestureConfidenceThreshold: 0.55,
};
