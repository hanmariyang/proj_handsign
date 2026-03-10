# Handsign 인터랙션 명세

## MVP 제스처

### Open Palm
- 입력 조건: canned gesture `Open_Palm`
- 장면 상태: `open-palm`
- 반응:
  - 필드가 넓게 퍼진다.
  - 드론 볼륨이 올라간다.
  - 황금색보다 청록색이 우세하다.

### Pinch
- 입력 조건: 엄지 끝과 검지 끝 거리 기반 연속값
- 장면 상태: `pinch-focus`
- 반응:
  - 입자 밀도가 중심에 모인다.
  - 포인터 주변 회전이 강해진다.
  - 필터 cutoff와 밝기가 증가한다.

### Victory
- 입력 조건: canned gesture `Victory`
- 장면 상태: `victory-flare`
- 반응:
  - 후광과 잔광이 강화된다.
  - 사운드 리버브와 존재감이 커진다.
  - 장면이 가장 따뜻한 색으로 이동한다.

## 수치 규칙

### Pinch distance
- 활성 기준: `0.035`
- 해제 기준: `0.12`
- 정규화: 거리값을 `0..1` 범위의 `pinch` 값으로 역변환

### 제스처 라벨
- canned gesture가 `None`이거나 신뢰도가 낮으면 라벨을 버린다.
- `Victory`와 `Open_Palm`은 pinch보다 우선한다.
- 라벨이 없고 손이 감지되면 기본 상태는 `tracking`으로 둔다.

## 상태 우선순위
1. `Victory`
2. `Open_Palm`
3. `Pinch`
4. `Tracking`
5. `Idle`

## HUD 표시 항목
- 현재 세션 상태
- 현재 장면 상태(`sceneMode`)
- 현재 gesture label
- pinch 값
- render/inference fps

## 후속 확장 후보
- `Thumb_Up`: 장면 리셋 또는 고정
- `Pointing_Up`: 포인터 기반 드로잉 모드
- 양손 모드: 좌/우 손 역할 분리
