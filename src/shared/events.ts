export interface RuntimeMetrics {
  renderFps: number;
  inferenceFps: number;
  lastInferenceMs: number;
  audioReady: boolean;
}

export function createEmptyMetrics(): RuntimeMetrics {
  return {
    renderFps: 0,
    inferenceFps: 0,
    lastInferenceMs: 0,
    audioReady: false
  };
}
