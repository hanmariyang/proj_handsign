# 브라우저 기반 손 형상 인식 미디어아트 웹앱 구축 심층 리서치 보고서

## Executive Summary

본 보고서는 “브라우저에서 카메라로 사용자의 손 형상(랜드마크/제스처)을 실시간 인식하고, 이를 시각·음향 미디어아트 인터랙션으로 연결”하는 웹앱을 목표로 할 때의 **모델/라이브러리 선택, 카메라·렌더링 파이프라인, 미디어아트 통합 아키텍처, 성능 최적화, 프라이버시·보안, 프로토타입 로드맵**을 공식 문서·원 논문 중심으로 정리한다. 핵심 결론은 다음과 같다. (기기/브라우저 범위는 “미정”이며 아래 가정 섹션에 명시)

첫째, **랜드마크(21 keypoints) 기반 인터랙션**이 중심이라면, 최신 **MediaPipe Tasks(Hand Landmarker / Gesture Recognizer)** 계열이 “웹 통합 난이도 대비 품질·기능 폭”이 가장 좋다. 다만 Web용 API는 `detectForVideo()`/`recognizeForVideo()`가 **동기(synchronous)로 UI 스레드를 블로킹**하므로, 고프레임 경험을 원하면 **Web Worker로 추론을 분리**하는 설계가 사실상 필수다. citeturn11view0turn26view0

둘째, **성능 수치가 공개된 대표 기준**으로 MediaPipe Hands(핵심 논문)에는 (1) palm detector의 ablation 결과(AP 95.7%까지)와 (2) hand landmark 모델의 **추론 시간(ms)** 및 품질(MSE)이 제시되어 있다. 예컨대 표기된 “Full” 구성은 **Pixel 3에서 16.1ms, Galaxy S20에서 11.1ms, iPhone11에서 5.3ms**로 보고되며(논문 Table 3), palm detector는 focal loss 구성에서 **AP 95.7%**가 보고된다. citeturn38view0 또한 공식 모델카드에서는 지역/피부톤/성별 하위집단에 대해 **MNAE(손바닥 크기 정규화 MAE)** 기반 평가와 “Lite 평균 12.02, Full 평균 10.09” 등 수치가 제공된다. citeturn19view0

셋째, **TensorFlow.js 계열**은 (A) `hand-pose-detection`(MediaPipe 런타임 또는 tfjs 런타임)처럼 “웹 친화 API + 다중 손 + keypoints3D”를 제공하는 경로와, (B) 레거시 `handpose`(단일 손)처럼 매우 가벼운 경로가 공존한다. 레거시 `handpose` README에는 **가중치 약 12MB**, 그리고 **2018 MacBook Pro 40FPS / iPhone11 35FPS / Pixel3 6FPS** 같은 성능 언급이 있어(테스트 환경 한정) 빠른 프로토타이핑 기준점으로 쓸 수 있다. citeturn10view0

넷째, 모델/런타임 선택을 “프로젝트 자산화(커스텀 모델, 양자화, 배포 제어)” 관점에서 보면 **ONNX Runtime Web**이 강력한 대안이다. ONNX Runtime Web 문서는 브라우저 내 추론이 “데이터가 기기를 떠나지 않아 프라이버시에 유리하고, 오프라인 동작·클라우드 비용 절감”을 강조하며, 실행 프로바이더로 WASM/웹GPU/웹NN 등을 언급한다(단, GPU 계열은 연산자 지원이 부분적일 수 있음). citeturn30view0turn12view2 다만 WebGPU는 브라우저 지원 편차가 크며(예: Safari는 부분 지원/기본 비활성 구간이 길었고, Firefox는 기본적으로 비활성 구간이 큼), 실제 타깃 브라우저가 확정되지 않았다면 “WASM 우선 + WebGPU 옵션”이 안전하다. citeturn12view1turn17view0

다섯째, 미디어아트(시각·음향) 결합에서는 **Tone.js(음향 합성/스케줄링), three.js(3D/파티클/XR), p5.js(크리에이티브 코딩·WebGL 모드), regl(WebGL 커맨드 기반 셰이더 파이프라인)** 조합이 검증된 스택이다. Tone.js는 “사용자 클릭 같은 유저 액션 이후 `Tone.start()` 호출”을 명시하고, Web Audio는 자동재생 정책 때문에 “유저 제스처 안에서 컨텍스트 생성/재개”가 권장된다. citeturn14search10turn14search0turn14search1

여섯째, 성능 최적화는 “추론 스레딩/드로잉 스레딩/프레임 샘플링/모델 경량화”의 합으로 접근해야 한다. OffscreenCanvas는 “DOM과 분리된 캔버스를 워커에서 렌더링 가능”하게 하며, Safari 지원은 버전대에 따라 과거 미지원→부분지원→지원으로 변화해 왔다(구버전 타깃이면 폴백 필요). citeturn16search4turn16search0 또한 ONNX Runtime Web는 WASM 스레드/ SIMD 바이너리 구성과 `env.wasm.numThreads`, `env.wasm.proxy`(프록시 워커) 같은 옵션을 제공하지만, 멀티스레딩은 **WebAssembly threads 지원 + `crossOriginIsolated`** 조건이 필요하다. citeturn12view0turn12view2

마지막으로, 카메라·센서 앱은 개인정보 민감도가 높으므로 권한 UX가 품질을 좌우한다. web.dev는 “페이지 로드 시 권한 요청 금지, 유저가 맥락을 이해하는 순간에 요청, 사전 프롬프트(pre-prompt)로 설명 후 브라우저 프롬프트 호출, 차단 상태 회복 안내” 같은 베스트 프랙티스를 제시한다. citeturn28view0

## 범위·미정 사항·가정

요청사항에서 다음 항목이 **미정(unspecified)** 이다: **타깃 디바이스(모바일/데스크톱 비율), 최소 지원 브라우저/버전(특히 iOS Safari), 네트워크 조건(오프라인 필요 여부), 추론이 로컬만인지(서버 전송 여부), XR(WebXR) 필요 여부, 설치형(PWA) 여부**.

본 보고서는 미정 사항을 다음처럼 **가정(assumption)** 하여 분석한다(실제 요구가 달라지면 권고가 달라질 수 있음).

- **클라이언트 로컬 추론**(카메라 프레임을 서버로 업로드하지 않음)을 기본으로 가정(프라이버시/지연 최소화 목적). citeturn30view0turn13search17  
- 브라우저는 **최신 Chromium 계열 + iOS Safari 포함 가능성**을 가정(실무에서 가장 흔한 리스크 구간). WebGPU/OffscreenCanvas/SharedArrayBuffer는 브라우저·버전 편차가 크다는 점을 전제한다. citeturn17view0turn16search0turn17view1  
- “미디어아트 경험” 특성상 **지연(latency)과 프레임 안정성(stability)** 이 품질 핵심 지표라고 가정한다(정확도만 최적화하면 체감이 나빠질 수 있음). MediaPipe 문서에서도 카메라 프레임 처리 시 메인 스레드 블로킹 문제가 직접 언급된다. citeturn11view0turn26view0  

## 손 인식·제스처 라이브러리/모델 비교 및 권고

아래 비교는 “웹앱에서 카메라 기반 손 인터랙션”이라는 동일 목표를 두고, 각 옵션을 **출력 형태(박스/랜드마크/제스처), 공개 정확도 지표 유무, 공개 지연 성능, 브라우저 런타임(WASM/WebGL/WebGPU) 관점, 라이선스, 통합 난이도**로 정리한다. 수치가 없는 항목은 “공개 자료에서 미확인(unspecified)”로 표기한다.

### 비교 표

| 옵션(요구된 후보) | 출력/기능 | 정확도(공개 지표) | 지연/성능(공개 수치) | 브라우저 호환/런타임 포인트 | 라이선스 | 통합 난이도(정성) |
|---|---|---|---|---|---|---|
| MediaPipe Hands / Hand Landmarker | 다중 손 랜드마크(21), world landmarks, handedness; 트래킹 로직 포함 | 모델카드: MNAE 기반 지역별/피부톤 평가(예: 평균 Lite 12.02, Full 10.09) citeturn19view0 | API 자체는 동기 호출로 메인 스레드 블록 → Worker 권장 citeturn11view0 | `@mediapipe/tasks-vision` + WASM 로딩 경로 사용 citeturn11view0 | Apache 2.0(레포/모델카드 명시) citeturn8search0turn19view0 | **중(권장)**: Tasks API는 단순하나 워커/렌더링 분리가 핵심 |
| MediaPipe Gesture Recognizer | 랜드마크 + (canned) 제스처 분류 + 커스텀 제스처 분류 옵션, numHands 등 | canned gesture 목록(예: Thumb_Up 등) 제공. 정량 정확도는 문서에 직접 수치 없음(가이드 중심) citeturn26view0 | `recognizeForVideo()` 동기, 메인 스레드 블록 → Worker 권장 citeturn26view0 | `@mediapipe/tasks-vision` + `.task` 모델 로딩 citeturn26view0 | Apache 2.0(솔루션 문서의 코드 라이선스 표기 포함) citeturn26view0turn8search4 | **중(권장)**: 즉시 “제스처 이벤트”가 필요하면 매우 효율적 |
| TFJS hand-pose-detection | MediaPipe Hands 기반 다중 손, 21 keypoints + keypoints3D + handedness | 공개 정량 수치는 README에 직접 없음(모델카드 링크 제공) citeturn10view1 | 수치 직접 제시는 없음. runtime 선택에 따라 상이(‘mediapipe’ vs ‘tfjs’) citeturn10view1 | 구성에서 runtime (`mediapipe`/`tfjs`) 선택, `@mediapipe/hands` 경로 지정 citeturn10view1 | Apache 2.0 계열(레포 전반 라이선스 안내 근거는 TFJS/MediaPipe 라이선스 문맥) citeturn34view0turn8search0 | **중**: TFJS 생태계 친화. 다만 런타임/백엔드 선택에 따른 튜닝 필요 |
| TFJS handpose(레거시) | 단일 손(최대 1개) 21개 3D keypoints | “성능 특성은 모델카드 문서에 있다”로 링크 제공(README) citeturn10view0 | ~12MB weights, 40FPS(2018 MBP), 35FPS(iPhone11), 6FPS(Pixel3) citeturn10view0 | TFJS WebGL 백엔드 명시(대안으로 WASM 백엔드 언급) citeturn10view0 | TFJS 레포는 Apache-2.0(레포 표기) citeturn34view0 | **하(빠른 실험용)**: 기능 제한(단일 손) 수용 시 MVP에 유리 |
| ONNX Runtime Web(모델 커스텀) | “모델에 따라” (랜드마크/분류/검출 등 자유) | 런타임 자체 정확도는 모델 종속(unspecified) | 웹GPU/wasm 등 EP에 따라 달라짐. WebGPU의 경우 IO binding/graph capture 등 성능 기능 소개 citeturn12view1turn30view0 | 브라우저 내 추론: `onnxruntime-web`; EP로 wasm/webgpu/webnn 언급. WASM은 연산자 커버리지 최상(문서) citeturn30view0turn12view2 | MIT(ONNX Runtime) citeturn8search2turn8search10 | **중~상**: 모델 변환·전처리·후처리까지 책임 범위가 커짐 |
| handtrack.js | 손 **Bounding box + 간단한 포즈 라벨(Open/Closed/Pinch/Point 등)** | “더 정확해졌다”는 서술은 있으나 정량 지표 없음(early testing) citeturn10view2 | 예: 26FPS(2018 MBP, 450×380), 14FPS(2014 MBP) citeturn10view2 | TFJS 기반 객체검출(서술). 모바일 브라우저에서 광범위 테스트 부족/불일치 이슈 언급 citeturn10view2 | MIT(레포 표기) citeturn1search4 | **하(프로토타입용)**: 랜드마크가 필요하면 한계가 뚜렷 |
| Handsfree.js | 손/얼굴/포즈 트래킹 “통합 레이어 + 상호작용 예시” | 자체 정확도 지표 없음(래퍼 성격) citeturn18view1 | 성능 수치 직접 없음. 브라우저 확장/백그라운드 실행 구조 설명 중심 citeturn18view1 | “웹캠 권한 1회” 등 확장 기반 설계 소개; 인터랙티브 문서 제공 citeturn18view1 | Apache 2.0(명시) citeturn18view1 | **중**: 미디어아트 데모/상호작용 예시가 풍부하나, 자체 파이프라인 이해 필요 |
| fingerpose | **랜드마크 → 손가락 curl/direction → 제스처 매칭**(규칙 기반) | 정량 지표 없음(규칙 기반, 튜닝 필요) citeturn18view0 | 자체는 경량(분류 규칙)이나 전체 성능은 랜드마크 추론에 종속(unspecified) citeturn18view0 | “단계(1)는 Handpose가 수행, (2)(3)은 라이브러리가 수행” 명시 citeturn18view0 | MIT(레포 표기) citeturn18view0 | **중**: 커스텀 제스처를 “코드로 정의”할 때 매우 실용적 |
| 커스텀 모델(예: MediaPipe Model Maker, 자체 학습) | 요구 기능에 맞춘 제스처/랜드마크/분류 자유 설계 | 데이터·학습에 따라 상이. HaGRID 같은 대규모 제스처 데이터셋 존재 citeturn35view1 | 모델 크기/양자화/타깃 런타임에 따라 상이(unspecified) | MediaPipe Model Maker는 “온디바이스 모델 커스터마이징 로우코드”로 안내 citeturn35view0 | Model Maker 코드 Apache 2.0(노트북 헤더) citeturn35view0 | **상**: 데이터·학습·평가·배포까지 전체 파이프라인 필요 |

### 권고 조합(현실적인 “웹 미디어아트” 기준)

- **최소 통합/최대 즉효(추천 기본안)**: MediaPipe Hand Landmarker(+ 필요 시 Gesture Recognizer) + Web Worker 분리 + Canvas/WebGL 렌더링. MediaPipe 문서가 “동기 호출로 UI 스레드 블록, 워커로 분리”를 직접 권장하므로, 아트 경험의 프레임 안정성을 노릴 때 설계 근거가 명확하다. citeturn11view0turn26view0  
- **커스텀 제스처를 ‘코드 규칙’으로 빠르게 늘리고 싶을 때**: “랜드마크 추론(Hand Landmarker 또는 TFJS hand-pose-detection) + fingerpose(규칙 기반 분류)”가 실용적이다. fingerpose는 손가락 굽힘/방향 추정 후 제스처 설명과 비교하는 구조를 명시한다. citeturn18view0turn10view1  
- **연구/제품화 관점에서 모델 자산을 강하게 통제**(양자화, 자체 모델, 런타임 교체): ONNX Runtime Web을 고려한다. ONNX Runtime web 문서는 브라우저 내 추론의 장점(프라이버시/오프라인/비용)을 명시하지만, GPU EP는 연산자 제한이 있을 수 있고 WebGPU 지원 편차가 크므로 “WASM 기본 + WebGPU 옵션”이 보수적이다. citeturn30view0turn12view1turn17view0  
- **Bounding box만으로도 인터랙션이 성립**(예: 손 위치로 커서/파티클 어트랙터): handtrack.js가 가장 빠르다. 다만 모바일 브라우저에서 광범위 테스트가 부족하다고 명시되어 있어, “전시/공개 작품”이라면 타깃 디바이스 확정 후 검증이 필요하다. citeturn10view2  

## 카메라 접근과 렌더링 파이프라인

### 카메라 접근: getUserMedia / MediaStream 제약 / 권한 상태 확인

브라우저 카메라 입력의 표준 접근은 `navigator.mediaDevices.getUserMedia()`이며, 이는 로컬 미디어(오디오/비디오)를 요청하는 JS API 집합(“Media Capture and Streams”)에 속한다. citeturn37search0turn13search17 `getUserMedia()`는 프라이버시 민감 API로서 브라우저가 지켜야 할 보안·프라이버시 요구사항이 크며(문서에 별도 섹션 존재), **일반적으로 보안 컨텍스트(HTTPS 등)에서 사용**된다. citeturn13search17

실시간 미디어아트 앱에서 가장 중요한 제약은 보통 `width/height/frameRate/facingMode`다. 제약은 “선호(ideal) vs 강제(exact/min/max)”가 다르게 처리되며, 과도한 강제 제약은 `OverconstrainedError`로 거절될 수 있다. citeturn37search3turn37search2

권한 UX를 위해 “현재 권한 상태”를 확인하려면 Permissions API의 `navigator.permissions.query()`를 사용할 수 있으며, 권한 descriptor는 `name: 'camera'`처럼 API 이름을 가진다는 점이 명시되어 있다(단, 브라우저별 지원 편차는 별도 검증 필요). citeturn13search3turn13search11turn28view0

아래는 “전시/작품”에서 무난한 카메라 획득 패턴(예시)이다. 제약은 “가능하면 720p/30fps, 불가하면 폴백”을 유도하는 형태가 흔하다. (개별 기기 카메라 스펙에 따라 실제 해상도는 달라질 수 있음) citeturn37search3turn37search2

```ts
// camera.ts (예시)
export async function openCamera(videoEl: HTMLVideoElement) {
  // ideal은 "선호", exact/min/max는 "강제" 성격이 강함.
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: { ideal: "user" }, // 모바일 전면/후면 선택 힌트
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  videoEl.srcObject = stream;

  // iOS/Safari 포함, autoplay 제한 회피를 위해 보통 playsInline 필요(HTML 속성)
  await videoEl.play();
  return stream;
}
```

### WebRTC: 언제 필요한가?

WebRTC는 브라우저 간 “오디오/비디오 캡처 및 (옵션) 스트리밍”과 데이터 교환을 가능하게 하는 기술이며, 중개자 없이 P2P 통신이 가능하다는 점을 MDN이 설명한다. citeturn13search1turn13search5 즉, **로컬에서만 손 인식→시각/음향 반응**이면 WebRTC는 불필요하고, **원격 관객에게 스트림을 보내거나 다자간 상호작용**이 목표일 때 RTCPeerConnection/시그널링을 포함한 WebRTC 스택이 필요해진다(권한·보안 고려도 확대). citeturn37search15turn13search0

### 렌더링 선택지: Canvas2D / WebGL2 / WebGPU / WebXR

- **Canvas2D**: 가장 단순하며 텍스트/라인/마커 오버레이가 쉬운 경로(디버그/프로토타입에 최적). citeturn2search16  
- **WebGL/WebGL2**: GPU 셰이더 기반 후처리, 파티클, 비디오 텍스처 기반 합성이 가능해 미디어아트 표현력이 높다. WebGL2 지원은 Safari/iOS Safari 버전에 따라 과거 “비활성/미지원” 구간이 있었으므로(구버전 타깃이면 주의), 배포 전 타깃 버전 확정이 중요하다. citeturn16search3turn2search17  
- **WebGPU**: ML/그래픽 compute 모두에 유망하지만 지원 편차가 크다(예: Can I use 기준 Safari는 부분 지원/기본 비활성 구간이 길었고, Firefox는 기본적으로 Disabled by default 구간이 큼). citeturn17view0turn2search18  
- **WebXR**: XR 디바이스(AR/VR)와 결합 시. three.js는 WebXRManager로 WebXR Device API를 감싸는 구조를 문서화한다. citeturn6search1turn2search19  

### 실시간 오버레이 파이프라인 예시와 스레딩 핵심

MediaPipe Tasks 문서는 Hand Landmarker / Gesture Recognizer의 `detectForVideo()` / `recognizeForVideo()`가 **동기 실행으로 UI 스레드를 블로킹**하며, 카메라 프레임 처리에서는 **Web Worker로 다른 스레드에서 실행**하라고 명시한다. citeturn11view0turn26view0 이 문장 하나가 “아트 경험”에서 **아키텍처 선택의 결정적 근거**가 된다: “추론(무거운 일)”과 “렌더링(UI)”를 분리하지 않으면 프레임 드랍/입력 지연이 눈에 띄게 악화될 수 있다.

아래는 권장되는 데이터 흐름(개념도)이다.

```mermaid
flowchart LR
  A[Camera getUserMedia] --> B[HTMLVideoElement]
  B --> C[Frame Extractor<br/>(rAF, video.currentTime gate)]
  C --> D[Preprocess<br/>(resize/rotate/normalize)]
  D --> E[Hand Inference<br/>(Landmarks/Gestures)]
  E --> F[Postprocess<br/>(gesture mapping, smoothing)]
  F --> G[Render Overlay<br/>(Canvas2D/WebGL)]
  F --> H[Audio Engine<br/>(Web Audio/Tone.js)]
  G --> I[Screen Output]
  H --> I
```

이미지/시각적 예시를 빠르게 참고할 때는 MediaPipe 공식 가이드가 직접 연결하는 데모/CodePen이 유용하다(Hand Landmarker, Gesture Recognizer 모두 “브라우저에서 실행/편집 가능한 예제 코드” 링크를 제공). citeturn11view0turn26view0  

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["MediaPipe hand landmarker demo web overlay","MediaPipe gesture recognizer web demo","handsfree.js generative art with hand gestures","three.js particle system hand tracking webcam"],"num_per_query":1}

## 미디어아트 통합 패턴

### 오디오(사운드) 통합: Tone.js 중심 패턴과 “유저 제스처” 제약

Tone.js는 브라우저에서 인터랙티브 음악을 만들기 위한 Web Audio 프레임워크로, 트랜스포트/스케줄링/신스/이펙트 등 DAW 유사 구조를 제공한다고 GitHub README가 설명한다. citeturn6search0turn7search1 다만 브라우저 자동재생 정책 때문에, **유저 입력 이후에 오디오 컨텍스트를 시작/재개**해야 한다는 점이 중요하다. MDN은 자동재생 정책을 “유저 제스처 내부에서 컨텍스트 생성/재개(create or resume)”로 요약하며, Tone.js 문서도 `Tone.start()`를 유저 액션 이벤트(클릭/키다운 등)에서 호출하라고 명시한다. citeturn14search0turn14search10turn14search1

손 랜드마크 기반 사운드 매핑은 보통 다음 3층으로 나눈다.

1) **피처 추출(feature)**: pinch 거리(엄지-검지), 손바닥 중심 속도, 손 회전(랜드마크 벡터) 등  
2) **제스처/상태 머신(state)**: “Pinch 시작/유지/종료”, “Open palm”, “Victory” 등 이벤트화(또는 연속값)  
3) **파라미터 매핑(mapping)**: pitch/필터 cutoff/리버브 wet/그래뉼러 density 등으로 변환

fingerpose는 (1) 랜드마크 검출 → (2) 손가락 굽힘/방향 추정 → (3) 제스처 설명과 비교라는 구조를 명시해 “상태 머신”을 코드로 만드는 데 적합하다. citeturn18view0

### 비주얼(생성형/셰이더/파티클) 통합: p5.js / three.js / regl

- **p5.js**는 2D/WEBGL 두 렌더러를 제공하며, WEBGL 모드에서 WebGL API를 사용한 고성능 2D/3D 및 이미지 처리 작업이 가능하다고 문서가 설명한다. citeturn6search2turn6search6 셰이더 튜토리얼은 “p5.js 캔버스를 WEBGL 모드로 설정”하는 과정을 안내한다. citeturn6search14  
- **three.js**는 WebGL 렌더러가 WebGL2를 사용한다고 문서화하며(버전 정책에 따라 WebGL1 미지원), WebXRManager로 WebXR Device API를 추상화한다. citeturn6search5turn6search1  
- **regl**은 WebGL의 공유 상태를 최소화하고 “리소스/커맨드”라는 두 추상으로 WebGL 코드를 단순화한다고 README가 밝힌다(MIT). citeturn6search3turn6search7 이는 “셰이더 기반 후처리/피드백 루프/파티클” 같은 미디어아트 패턴에서 특히 강점이 있다.

아래는 “랜드마크 → 오디오/비주얼 동시 제어”의 최소 코드 스케치(개념 예시)다. (실제 앱에서는 워커-메인 스레드 메시징, 스무딩, 오류 처리 등을 추가 권장. MediaPipe는 메인 스레드 블로킹을 경고한다.) citeturn11view0turn26view0

```ts
// mapping.ts (개념 예시)
type Landmark = { x: number; y: number; z?: number };

export function pinchDistance(thumbTip: Landmark, indexTip: Landmark) {
  const dx = thumbTip.x - indexTip.x;
  const dy = thumbTip.y - indexTip.y;
  return Math.hypot(dx, dy); // normalize 여부는 좌표계에 맞춰 조정
}

export function map01(v: number, inMin: number, inMax: number) {
  const t = (v - inMin) / (inMax - inMin);
  return Math.min(1, Math.max(0, t));
}
```

```ts
// audio.ts (개념 예시)
// Tone.js는 유저 입력 이벤트에서 Tone.start() 호출을 요구함.
import * as Tone from "tone";

export async function startAudio() {
  await Tone.start();
  const synth = new Tone.MonoSynth().toDestination();
  return { synth };
}

export function applySound({ synth }: { synth: Tone.MonoSynth }, pinch01: number) {
  const cutoff = 200 + pinch01 * 4000;
  synth.filterFrequency.value = cutoff;
  synth.triggerAttackRelease("C4", "16n");
}
```

구성요소 관계를 “미디어아트 엔진” 관점으로 정리하면 다음과 같은 컴포넌트 분리가 유지보수에 유리하다(특히 커스텀 제스처/연출 확장 시).

```mermaid
flowchart TB
  subgraph Input
    CAM[Camera Stream] --> VID[Video Element]
  end

  subgraph ML
    VID --> INF[Hand Inference<br/>(Landmarks/Gestures)]
    INF --> FEAT[Feature/State Engine]
  end

  subgraph Media
    FEAT --> VIS[Visual Engine<br/>(p5/three/regl)]
    FEAT --> AUD[Audio Engine<br/>(Tone/Web Audio)]
  end

  VIS --> OUT[Display]
  AUD --> OUT
```

## 성능 최적화 전략

### 목표 FPS 설정과 프레임 제어

JS 애니메이션 루프는 보통 `requestAnimationFrame()`(rAF)을 사용한다. MDN은 rAF가 “다음 repaint 전에 콜백을 호출”하고 `setTimeout` 대비 효율적임을 설명한다. citeturn5search18 MediaPipe Hand Landmarker 및 Gesture Recognizer 예제는 `video.currentTime`가 변할 때만 추론을 실행하는 패턴을 보여, “프레임 중복 추론 방지”의 실용적 기준을 제공한다. citeturn11view0turn26view0

실무적으로는 **렌더링 60fps를 유지하되 추론은 30fps로 다운샘플**(또는 상황에 따라 15fps)하는 전략이 흔하다. 이는 “입력 지연을 과도하게 늘리지 않으면서” GPU/CPU 사용량을 제어하기 쉽기 때문이다. (다만 구체 수치는 타깃 기기/브라우저 미정이므로 확정 불가)

### 모델 경량화: Lite/Full 선택, 양자화(quantization)

MediaPipe Hands 논문은 “Full” 모델이 품질-속도 트레이드오프에서 적절하며, 더 무거운 모델은 품질 개선이 작고 속도가 크게 떨어질 수 있다고 설명한다(표 3으로 근거). citeturn38view0 공식 모델카드도 Lite/Full을 별도 파이프라인으로 정의한다. citeturn19view0

양자화는 웹 배포에서 특히 중요하다. TensorFlow Model Optimization 가이드는 기본 설정에서 **모델 크기 4배 축소**와 “테스트 백엔드에서 CPU 지연 1.5~4배 개선”이 흔하다고 명시한다. citeturn5search4turn5search12 ONNX Runtime 문서도 dynamic/static/QAT 등 양자화 방식의 범주를 정리한다. citeturn5search5  
handtrack.js는 fp16/int8 양자화 모델 사이즈 예(12MB→6MB→3MB)를 README에서 직접 제시하며, 작은 버전이 “비슷한 정확도”를 보일 수 있다고 서술한다(단, FPS는 비슷하다는 주석도 함께 존재). citeturn10view2

### WASM SIMD/threads, WebWorker, OffscreenCanvas

ONNX Runtime Web는 배포 문서에서 WebAssembly 바이너리 종류(예: `ort-wasm-simd-threaded.wasm` 등)와 “SIMD/멀티스레딩/JSEP(WebGPU/WebNN용)” 조합을 표로 설명한다. citeturn12view2 또한 `env.wasm.numThreads`는 브라우저에서 기본적으로 `hardwareConcurrency` 기반으로 스레드 수를 정하고, **멀티스레딩은 WebAssembly threads 지원 + `crossOriginIsolated` 활성화 조건에서만 켜진다**고 명시한다. citeturn12view0  
같은 문서에서 `env.wasm.proxy`는 “무거운 연산을 Web Worker로 오프로딩”해 UI 응답성을 높일 수 있지만, WebGPU EP와는 함께 쓸 수 없고(CPU↔GPU 버퍼 전송 제한), CSP 제한 환경에서는 Blob 워커 생성이 막힐 수 있다고 명시한다. citeturn12view0

렌더링 측면에서는 OffscreenCanvas가 핵심 도구다. MDN은 OffscreenCanvas가 “DOM과 분리된 캔버스”로 워커에서 렌더링을 가능하게 하여 메인 스레드의 무거운 작업을 피할 수 있다고 설명한다. citeturn16search4turn3search1 다만 Safari 지원은 과거 미지원 구간이 길었고(특정 버전대에서 partial→지원으로 변화), “최소 지원 버전이 미정”인 현재 조건에서는 폴백(메인 스레드 Canvas2D / 단순 WebGL)을 설계에 포함하는 편이 안전하다. citeturn16search0

### SharedArrayBuffer와 COOP/COEP(크로스-오리진 격리)의 함의

고성능 WASM 멀티스레딩은 종종 SharedArrayBuffer와 결합되며, SharedArrayBuffer는 “Workers 간 공유 가능한 ArrayBuffer”라는 점이 요약되어 있다. citeturn17view1 또한 cross-origin isolation 요건을 충족해야 한다는 점이 널리 알려져 있으며, ONNX Runtime Web 문서도 멀티스레딩 활성화 조건으로 `crossOriginIsolated`를 명시한다. citeturn12view0  
따라서 전시/배포 환경에서 CDN·임베드 리소스 정책을 어떻게 구성할지(특히 COOP/COEP 적용 가능 여부)는 초기부터 결정해야 한다. (어떤 호스팅/임베드 요구가 있는지 현재 미정)

### WebGPU 최적화: IO binding / Graph capture(조건부)

ONNX Runtime WebGPU 문서는 “WebGPU는 WebGL보다 효율적이고 ML/그래픽/compute 용도”를 명시하며, Chrome/Edge는 최신에서 기본 제공, Firefox는 플래그 뒤, Safari는 Technology Preview라는 상태를 언급한다. citeturn12view1turn17view0 또한 WebGPU 사용 시 CPU↔GPU 메모리 복사를 줄이기 위한 **IO binding(입출력을 GPU에 유지)** 기능을 설명한다. citeturn12view1  
다만 WebGPU는 지원 편차가 커서(특히 Safari/Firefox), “타깃 브라우저가 확정되지 않은 단계”에서는 **WASM 기반 안정 동작을 먼저 확보**하고, WebGPU는 **점진적 향상(progressive enhancement)** 으로 추가하는 전략이 안전하다. citeturn30view0turn17view0

## 프라이버시·보안·권한 UX

### 권한 요청 UX: “언제/어떻게”가 성공률을 좌우

권한 프롬프트는 사용자의 프라이버시·보안을 보호하기 위한 핵심 메커니즘이며, web.dev는 모범사례로 다음을 강조한다.  
(1) **페이지 로드 시 즉시 요청하지 말 것**, (2) 사용자가 “왜 필요한지/어떤 이득이 있는지” 이해 가능한 순간에 요청할 것, (3) 브라우저 프롬프트 전에 자체 설명 UI(pre-prompt)를 둘 것, (4) 너무 잦은 프롬프트로 “차단 상태”에 빠지게 하지 말 것, (5) 차단 시 복구 안내 제공. citeturn28view0  
이는 미디어아트 앱에서도 그대로 적용된다. 예: “Start Experience” 버튼(유저 클릭) → “카메라가 필요합니다(손 제스처로 사운드를 연주합니다)” 설명 → 동의 시 getUserMedia 호출.

Permissions API는 권한 상태를 질의할 수 있으며, `name: 'camera'` 같은 permission name과 “지원하지 않으면 TypeError로 reject될 수 있음”을 MDN이 설명한다. citeturn13search3turn13search11 단, 브라우저 호환은 기능·버전에 따라 달라질 수 있으므로(지원 범위 미정), **“권한 질의 실패 시에도 정상 UX로 폴백”** 해야 한다.

### getUserMedia 보안 컨텍스트와 데이터 최소화

MDN은 `getUserMedia()`가 “상당한 프라이버시 우려가 있는 API”이며 스펙이 다양한 보안/프라이버시 요구사항을 규정한다고 명시한다. citeturn13search17 이로부터 파생되는 실무 권고는 다음과 같다.

- **로컬 추론 우선**: 브라우저 내 추론(특히 ONNX Runtime Web 문서가 강조하는 장점: 데이터가 기기를 떠나지 않아 프라이버시에 유리)을 기본으로 설계한다. citeturn30view0  
- **최소 수집**: 오디오가 필요 없다면 `audio:false`. 영상도 필요 최소 해상도/프레임으로(과도 스펙은 과도한 개인정보·리소스 사용). 제약 시스템은 ideal/exact 차이를 가지며, 과도한 exact는 실패를 유발할 수 있다. citeturn37search3turn37search2  
- **권한 정책(임베드/서드파티 통제)**: iframe을 쓰는 경우, Permissions Policy의 `allow` 속성이나 HTTP `Permissions-Policy` 헤더로 카메라 접근을 의도대로 제한할 수 있다. citeturn13search2turn13search10  

### WebRTC를 사용할 경우의 보안 고려(선택 사항)

WebRTC를 통해 미디어를 외부로 전송하는 경우(원격 관객·공연 협업 등), 위협 모델이 커진다. IETF RFC 8826은 WebRTC 위협 모델을 정의하고 보안 위협을 분석하는 표준 트랙 문서임을 밝힌다. citeturn13search0turn13search4  
따라서 “로컬 미디어아트”를 넘어 “네트워크 공연/협업”으로 확장한다면, 전송 경로(시그널링, TURN 서버 운영, 접근 제어 등)까지 포함한 보안 설계가 필요하다(현재 요구는 미정).

### 리소스 해제(close)와 메모리/성능 위생

웹에서 ML을 사용할 때 “작업 종료 후 close()로 리소스 해제”를 강조하는 공식 가이드가 존재한다(예: Gesture Recognizer 사용 후 `gestureRecognizer.close()` 예시). citeturn27search0turn27search1 실시간 카메라 앱에서 누수는 장시간 전시에서 프레임 저하·크래시로 이어질 수 있으므로, **“세션 수명주기(시작/정지/재시작)”를 명확히 하는 설계**가 중요하다.

## 프로토타입 로드맵과 레퍼런스

### MVP 목표 정의(권장 최소 기능)

MVP는 “랜드마크 인식이 실제로 미디어아트 경험으로 연결된다”를 가장 빠르게 증명해야 한다. 타깃 디바이스/브라우저가 미정이므로, MVP는 **Chrome/Edge 최신에서 우선** 검증하고 iOS Safari를 다음 마일스톤에서 안정화하는 순서가 리스크가 낮다(지원 편차가 큰 WebGPU/OffscreenCanvas/SharedArrayBuffer를 후순위로 둠). citeturn17view0turn16search0turn17view1

### 마일스톤(예시) 및 작업 난이도 추정

아래 effort는 “1~2인 개발”을 가정한 **정성 추정(Low/Med/High)** 이다(프로젝트 범위/팀 역량/디바이스 확정 여부에 따라 크게 변동).

| 마일스톤/작업 | 산출물 | Effort |
|---|---|---|
| 카메라 스트림 + UI(시작 버튼/권한 안내) | getUserMedia 기반 영상 표시, 실패/거부 UX | Low citeturn37search3turn28view0 |
| Hand Landmarker 단일 손 + Canvas2D 디버그 오버레이 | 21 랜드마크 점/선 표시, 프레임 루프(중복 추론 방지) | Med citeturn11view0 |
| 추론 Web Worker 분리(핵심) | 메인 스레드 프레임 안정화(블로킹 제거) | Med~High citeturn11view0turn5search7 |
| Gesture Recognizer(선택)로 이벤트화 | “Thumb_Up/Victory/Pointing_Up…” 이벤트로 시각/음향 트리거 | Med citeturn26view0 |
| 오디오 엔진(Tone.js) 연결 | 유저 제스처로 `Tone.start()`, pinch/gesture→사운드 파라미터 | Med citeturn14search10turn14search0turn6search0 |
| 비주얼 엔진(three.js 또는 regl) | 파티클/셰이더/피드백 등 1~2개 “대표 연출” 완성 | Med~High citeturn6search5turn6search3 |
| 성능 튜닝(프레임 샘플링, 모델 Lite/Full 스위치) | 기기별 preset(저사양/고사양), FPS 안정화 | Med citeturn19view0turn38view0turn11view0 |
| OffscreenCanvas/추가 멀티스레딩(가능할 때) | 워커 렌더링, 메인 스레드 부담 감소 | High(브라우저 편차) citeturn16search4turn16search0 |
| 커스텀 제스처 모델(선택) | Model Maker로 신제스처 학습/배포 | High citeturn35view0turn35view1 |
| ONNX Runtime Web 폴백(선택) | 특정 브라우저/기기에서 다른 런타임 옵션 제공 | Med~High citeturn30view0turn12view0turn12view1 |

### 권장 개발 스택(요청 조건 반영)

- 프론트엔드: TypeScript + Vite(MIT) citeturn8search3turn8search15  
- 손 인식: MediaPipe Tasks Vision(Hand Landmarker / Gesture Recognizer) 우선 + (필요 시) TFJS hand-pose-detection 폴백 citeturn11view0turn26view0turn10view1  
- 렌더링: Canvas2D(디버그/오버레이) + three.js(WebGL2 기반, XR 확장 용이) 또는 regl(셰이더/커맨드 중심) citeturn6search5turn6search1turn6search3  
- 오디오: Tone.js(+ Web Audio 정책 준수) citeturn6search0turn14search10turn14search0  
- 성능/스레딩: Web Worker + (가능 시) OffscreenCanvas; SharedArrayBuffer/COOP/COEP는 타깃 환경 확정 후 citeturn5search7turn16search4turn17view1turn12view0  
- 커스텀 모델/연구 확장: MediaPipe Model Maker(제스처 커스터마이징) 또는 ONNX Runtime Web(모델 자산화/양자화) citeturn35view0turn30view0turn5search5  

### 예제 프로젝트 및 1차 자료(논문/공식 문서) 레퍼런스

**공식 데모/가이드(웹 실행 예시 포함)**  
- Hand Landmarker Web 가이드(코드 예시/CodePen, 동기 호출·워커 권고 포함) citeturn11view0  
- Gesture Recognizer Web 가이드(데모/CodePen, canned gesture 목록, 동기 호출·워커 권고 포함) citeturn26view0  
- “웹에서 MediaPipe로 ML 사용할 때의 권장/금지 사항(한국어)”—close() 사용, 모델 번들링 회피 등 citeturn27search0turn27search1  

**핵심 원논문/모델카드**  
- MediaPipe Hands 논문(2-stage 파이프라인, palm detector AP, landmark 추론 시간/품질 지표) citeturn38view0  
- Hand Tracking Model Card(Lite/Full, MNAE 기반 하위집단 평가, 사용 범위/한계/윤리 고려) citeturn19view0  

**데이터셋/학술 레퍼런스(커스텀 제스처·일반화)**  
- HaGRID 데이터셋(WACV 2024): 554,800 이미지/18 제스처/바운딩박스 주석, 다양한 피사체·거리·조명 강조 citeturn35view1  
- FreiHAND(ICCV 2019): 데이터셋 편향과 cross-dataset generalization 문제 지적 및 대규모 멀티뷰 데이터셋 제안 citeturn36view0  

**브라우저 표준/보안(1차 규격)**  
- Media Capture and Streams(카메라/마이크 요청 표준) citeturn37search0  
- Permissions API / Permissions Policy(권한 조회 및 임베드 제어) citeturn13search6turn13search2turn13search10  
- WebRTC 보안 고려(IETF RFC 8826) citeturn13search0turn13search4  

**미디어아트 엔진 레퍼런스(공식)**  
- Tone.js(인터랙티브 음악 프레임워크) 및 “유저 액션 뒤 시작” 요구 citeturn6search0turn14search10turn14search0  
- p5.js WebGL 모드/셰이더 가이드 citeturn6search2turn6search14  
- three.js(WebGL2 렌더러, WebXRManager) citeturn6search5turn6search1  
- regl(Functional WebGL, MIT) citeturn6search3turn6search7