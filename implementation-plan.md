# Handsign 구현 계획서

## 목표
`project-plan.md`의 MVP를 실제 개발 단위로 분해하고, 초기 스프린트에서 바로 착수할 수 있는 작업 순서와 모듈 경계를 정의한다.

## 1차 스프린트 목표
- 브라우저에서 카메라 세션을 시작하고 종료할 수 있다.
- MediaPipe 기반 손 추론이 동작하고, 결과를 화면에 디버그 오버레이로 표시할 수 있다.
- 추론 결과를 받아 시각 효과와 오디오 파라미터를 제어하는 최소 인터랙션 루프를 만든다.

## 작업 스트림

### Stream A. 앱 셸과 상태 관리
- 전역 앱 레이아웃
- 세션 상태 머신(`idle`, `priming`, `running`, `paused`, `error`)
- 에러/권한/로딩 UI

### Stream B. 카메라와 미디어 권한
- `getUserMedia` 래퍼
- 비디오 엘리먼트와 스트림 수명주기 관리
- 권한 거부/미지원/장치 없음 처리

### Stream C. 추론 파이프라인
- 워커 초기화
- Gesture Recognizer 로드
- 프레임 전달 및 결과 메시지 프로토콜 정의
- 랜드마크/gesture/postprocess 결과 정규화

### Stream D. 인터랙션 매핑
- `Pinch`, `Open Palm`, `Victory` 상태 정의
- 임계값과 스무딩 전략 정의
- 결과를 시각/오디오 모듈에 전달하는 매퍼 작성

### Stream E. 비주얼 엔진
- three.js 씬 초기화
- 파티클 시스템 1종 구성
- 인터랙션 값에 따른 색, 밀도, 속도 변화

### Stream F. 오디오 엔진
- 사용자 액션 기반 오디오 시작
- 드론/패드 신스 구성
- `pinch`와 제스처를 파라미터에 매핑

## 모듈 구조

```text
src/
  app/
    App.tsx
    providers/
  components/
    StartScreen/
    StatusHud/
    PermissionNotice/
  features/
    session/
      session-machine.ts
      use-session-controller.ts
    camera/
      camera-service.ts
      camera-types.ts
    inference/
      inference-types.ts
      inference-bridge.ts
      landmark-utils.ts
    gestures/
      gesture-mapper.ts
      gesture-thresholds.ts
    visual/
      visual-engine.ts
    audio/
      audio-engine.ts
  workers/
    inference.worker.ts
  shared/
    math.ts
    events.ts
    constants.ts
```

## 메시지 프로토콜 초안

### 메인 스레드 -> 워커
- `INIT_INFERENCE`
- `PROCESS_FRAME`
- `DISPOSE_INFERENCE`

### 워커 -> 메인 스레드
- `INFERENCE_READY`
- `INFERENCE_RESULT`
- `INFERENCE_ERROR`

## 단계별 구현 순서

### Phase 0. 부트스트랩
- React + TypeScript + Vite 설정
- 기본 글로벌 스타일, 앱 루트, 정적 레이아웃
- 절대 경로 alias와 모듈 경계 정리

### Phase 1. 세션 기반 화면
- 시작 화면 작성
- 세션 상태 머신과 컨트롤러 작성
- 카메라 시작/정지 버튼 및 상태 UI 구현

### Phase 2. 추론 연결
- 워커 생성
- MediaPipe 로딩과 초기화
- 비디오 프레임 전달
- 오버레이로 랜드마크 렌더링

### Phase 3. 인터랙션 연결
- `pinch distance` 계산
- canned gesture와 커스텀 연속값 결합
- 비주얼 엔진과 오디오 엔진에 공통 인터랙션 상태 전달

### Phase 4. 정리
- 리소스 해제
- 성능 측정 HUD
- 저사양 폴백 처리

## 정의가 필요한 기술 계약

### `InferenceFrame`
- `timestamp`
- `width`
- `height`
- `imageBitmap`

### `InteractionState`
- `handDetected`
- `gestureLabel`
- `gestureConfidence`
- `pinch`
- `palmVelocity`

### `SessionSnapshot`
- `status`
- `errorMessage`
- `permissionState`
- `deviceInfo`

## 완료 기준

### 1차 완료
- 로컬에서 앱 실행 가능
- 시작 버튼으로 카메라와 오디오 세션 제어 가능
- 손이 보이면 디버그 랜드마크와 상태 HUD가 갱신됨
- `pinch` 값 하나가 시각 또는 오디오 반응으로 연결됨

### 2차 완료
- 기본 제스처 3종이 모두 식별되고 씬 반응이 달라짐
- 종료 후 재시작 시 리소스 누수 없이 정상 동작
- Safari 예외 케이스를 최소 수준으로 처리

## 당장 생성할 파일
- `package.json`
- `tsconfig.json`
- `tsconfig.app.json`
- `vite.config.ts`
- `index.html`
- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/app.css`
- `src/features/session/*`
- `src/features/camera/*`
- `src/features/inference/*`
- `src/workers/inference.worker.ts`

## 다음 구현 우선순위
1. 앱 부트스트랩
2. 세션 상태 머신
3. 카메라 서비스
4. 추론 워커 프로토콜
5. 디버그 HUD
6. three.js 씬 연결
7. Tone.js 연결
