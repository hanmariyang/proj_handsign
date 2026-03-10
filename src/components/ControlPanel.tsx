import {
  RUNTIME_PRESETS,
  type RuntimePresetId,
} from "@/features/session/runtime-settings";

interface ControlPanelProps {
  activePresetId: RuntimePresetId;
  onSelectPreset: (presetId: RuntimePresetId) => void;
}

export function ControlPanel({
  activePresetId,
  onSelectPreset,
}: ControlPanelProps) {
  return (
    <section className="control-panel">
      <div className="control-panel-header">
        <span className="permission-label">Runtime preset</span>
        <p>브라우저와 조명 조건에 맞춰 감도와 추론 fps를 바꿉니다.</p>
      </div>
      <div className="preset-grid">
        {RUNTIME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            className={`preset-button ${
              preset.id === activePresetId ? "is-active" : ""
            }`}
            type="button"
            onClick={() => onSelectPreset(preset.id)}
          >
            <strong>{preset.label}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
