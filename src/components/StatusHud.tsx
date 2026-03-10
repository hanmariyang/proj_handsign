import type { InteractionState } from "@/features/inference/inference-types";
import type { SessionSnapshot } from "@/features/session/session-machine";
import type { RuntimeMetrics } from "@/shared/events";

interface StatusHudProps {
  session: SessionSnapshot;
  metrics: RuntimeMetrics;
  interaction: InteractionState;
}

export function StatusHud({
  session,
  metrics,
  interaction,
}: StatusHudProps) {
  return (
    <aside className="status-hud">
      <div className="status-header">
        <span className={`status-pill status-${session.status}`}>
          {session.status}
        </span>
        <span className="status-subtle">
          {interaction.handDetected ? "hand detected" : "waiting"}
        </span>
      </div>
      <dl className="status-grid">
        <div>
          <dt>Mode</dt>
          <dd>{interaction.sceneMode}</dd>
        </div>
        <div>
          <dt>Gesture</dt>
          <dd>{interaction.gestureLabel ?? "None"}</dd>
        </div>
        <div>
          <dt>Pinch</dt>
          <dd>{interaction.pinch.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Render FPS</dt>
          <dd>{metrics.renderFps.toFixed(0)}</dd>
        </div>
        <div>
          <dt>Inference FPS</dt>
          <dd>{metrics.inferenceFps.toFixed(0)}</dd>
        </div>
        <div>
          <dt>Inference ms</dt>
          <dd>{metrics.lastInferenceMs.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Audio</dt>
          <dd>{metrics.audioReady ? "ready" : "off"}</dd>
        </div>
      </dl>
    </aside>
  );
}
