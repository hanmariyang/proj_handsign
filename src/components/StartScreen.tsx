import type { SessionSnapshot } from "@/features/session/session-machine";

interface StartScreenProps {
  session: SessionSnapshot;
  runtimePresetLabel: string;
  runtimeHint: string;
  onStart: () => void;
  onStop: () => void;
}

export function StartScreen({
  session,
  runtimePresetLabel,
  runtimeHint,
  onStart,
  onStop,
}: StartScreenProps) {
  const isRunning = session.status === "running";
  const isPriming = session.status === "priming";

  return (
    <section className="start-screen">
      <p className="eyebrow">Browser-based gesture instrument</p>
      <h1>Handsign</h1>
      <p className="hero-copy">
        손짓을 빛의 입자와 드론 사운드로 변환하는 실시간 미디어아트 실험입니다.
        카메라 프레임은 브라우저 안에서만 처리합니다.
      </p>
      <div className="preset-summary">
        <strong>{runtimePresetLabel}</strong>
        <span>{runtimeHint}</span>
      </div>
      <div className="hero-actions">
        {isRunning ? (
          <button className="primary-button" type="button" onClick={onStop}>
            Stop Session
          </button>
        ) : (
          <button
            className="primary-button"
            type="button"
            onClick={onStart}
            disabled={isPriming}
          >
            {isPriming ? "Preparing..." : "Start Experience"}
          </button>
        )}
      </div>
      <div className="preprompt-list">
        <p>카메라는 손 제스처 인식을 위해서만 사용합니다.</p>
        <p>오디오는 첫 클릭 이후에만 시작됩니다.</p>
        <p>조명이 어두우면 `Low Light` 프리셋으로 바꿔주세요.</p>
      </div>
      <div className="gesture-grid">
        <article>
          <strong>Open Palm</strong>
          <span>필드를 깨우고 드론을 연다</span>
        </article>
        <article>
          <strong>Pinch</strong>
          <span>입자 밀도와 필터를 조인다</span>
        </article>
        <article>
          <strong>Victory</strong>
          <span>잔향과 발광 강도를 높인다</span>
        </article>
      </div>
    </section>
  );
}
