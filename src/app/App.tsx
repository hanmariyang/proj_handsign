import { useState } from "react";
import { ControlPanel } from "@/components/ControlPanel";
import { PermissionNotice } from "@/components/PermissionNotice";
import { StartScreen } from "@/components/StartScreen";
import { StatusHud } from "@/components/StatusHud";
import { useSessionController } from "@/features/session/use-session-controller";
import {
  DEFAULT_RUNTIME_PRESET,
  RUNTIME_PRESETS,
  type RuntimePresetId,
} from "@/features/session/runtime-settings";

export function App() {
  const [runtimePresetId, setRuntimePresetId] = useState<RuntimePresetId>(
    DEFAULT_RUNTIME_PRESET.id,
  );
  const [debugVisible, setDebugVisible] = useState(true);
  const runtimePreset =
    RUNTIME_PRESETS.find((preset) => preset.id === runtimePresetId) ??
    DEFAULT_RUNTIME_PRESET;
  const { refs, session, metrics, interaction, startSession, stopSession } =
    useSessionController(runtimePreset);

  return (
    <main className="app-shell">
      <canvas className="scene-canvas" ref={refs.sceneCanvasRef} />
      <canvas
        className={`overlay-canvas ${debugVisible ? "is-visible" : ""}`}
        ref={refs.overlayCanvasRef}
      />

      <div className="ambient-gradient ambient-gradient-left" />
      <div className="ambient-gradient ambient-gradient-right" />

      <header className="app-chrome top-bar">
        <div>
          <p className="eyebrow">Realtime hand media study</p>
          <h2 className="brand-mark">Handsign</h2>
        </div>
        <div className="top-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => setDebugVisible((previous) => !previous)}
          >
            {debugVisible ? "Hide Debug" : "Show Debug"}
          </button>
          {session.status === "running" ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => void stopSession()}
            >
              Stop
            </button>
          ) : null}
        </div>
      </header>

      <div className="app-chrome hud-stack">
        <StatusHud
          session={session}
          metrics={metrics}
          interaction={interaction}
        />
        <PermissionNotice
          permissionState={session.permissionState}
          errorMessage={session.errorMessage}
          runtimeHint={runtimePreset.runtimeHint}
        />
        <ControlPanel
          activePresetId={runtimePresetId}
          onSelectPreset={setRuntimePresetId}
        />
      </div>

      <video
        className={`debug-video ${debugVisible ? "is-visible" : ""}`}
        ref={refs.videoRef}
      />

      <footer className="app-chrome bottom-note">
        <p>
          Desktop Chrome 기준 MVP를 우선 검증합니다. Safari는 다음 단계에서
          안정화합니다.
        </p>
      </footer>

      {session.status !== "running" ? (
        <div className="start-screen-wrap">
          <StartScreen
            session={session}
            runtimePresetLabel={runtimePreset.label}
            runtimeHint={runtimePreset.runtimeHint}
            onStart={() => void startSession()}
            onStop={() => void stopSession()}
          />
        </div>
      ) : null}
    </main>
  );
}
