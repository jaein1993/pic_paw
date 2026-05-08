# pic-paw — 프로젝트 회고 & 기술 스택

> 강아지 사진 합성 + 손 인식 4컷 부스 웹앱.
> 사용자가 카메라 앞에서 손짓으로 펫 위치/회전/크기를 조정하며 4장의 컷 사진을 자동 촬영하고
> GIF/영상으로 다운받을 수 있다.

---

## 📌 핵심 트러블슈팅 기록 (모바일 손 인식 회귀 사태)

### 1. 모바일에서 손 인식 완전 작동 불능 (시작점)

- **증상**: Galaxy + Chrome 147에서 카메라는 보이지만 손 인식 0건
- **첫 가설들 — 모두 빗나감**:
  - GPU delegate 실패 → CPU 폴백 추가 → 여전히 안 됨
  - 1080p 해상도 부담 → 720p로 다운 → 여전히 안 됨
  - 30fps 쓰로틀이 회귀 원인 → 제거 → 여전히 안 됨
- **결정적 검증**: 폰에서 **공식 MediaPipe Studio 데모** 접속 → 똑같이
  `CalculatorGraph::Run() failed` 에러 발생
- **결론**: 우리 코드 문제 X.
  **MediaPipe Tasks Vision (HandLandmarker)이 이 폰에서 호환 안 됨**

### 2. 라이브러리 교체 #1: Tasks Vision → MediaPipe Hands (legacy)

- **이유**: Tasks Vision이 폰에서 검출 0
- **결과**: 손 인식 검출됨 (`lastHands=2`) ✅
- **새 문제**: 너무 무거워서 컷 2 이후부터 거의 멈춤
- **구현 디테일**: legacy `@mediapipe/hands`는 UMD 패키지라 ES import 안 됨
  → 런타임 스크립트 태그 주입으로 `window.Hands` 접근

### 3. 모바일 메모리/CPU 폭주 (cut 2+ 프리즈)

원인 분해 (순서대로 처리):

| 비용 항목 | 변경 전 | 변경 후 | 효과 |
|---|---|---|---|
| MediaPipe 입력 해상도 | 720×1280 풀프레임 | 256² 오프스크린 다운스케일 | ~6× 빠름 |
| `numHands` | 2 | 1 | 추론 비용 50% |
| `modelComplexity` | full | lite (0) | WASM heap 부담 감소 |
| 녹화 fps × size | 8fps × 200² | 2fps × 128² | 메모리 1/3 |
| 녹화 합성 방식 | `stage.toCanvas()` 매 250ms (Konva 전체 재래스터) | 펫만 직접 `ctx.drawImage` | 매 frame 비용 90% 감소 |
| 카운트다운 | 10초 | 7초 | 컷당 부담 30% 감소 |
| 검출 간격 | rAF (~60Hz) | 30ms 최소 휴식 (16-25Hz cap) | CPU 숨 줄 시간 |

→ 그래도 끊김 잔존

### 4. TFJS hand-pose-detection 시도 (실패)

- 시도: `@tensorflow-models/hand-pose-detection`로 교체
- 빌드 실패: 패키지가 내부적으로 `@mediapipe/hands` import →
  Turbopack이 UMD 패키지 ES export 못 찾음
- 우회 가능했지만 (CDN 스크립트), 효과 불확실해서 롤백

### 5. 라이브러리 교체 #2: legacy Hands → Tasks Vision 재시도 (현재 = 최종)

- **차이점**: 이전엔 GPU 시도 후 CPU 폴백 → 지금은 **CPU delegate 처음부터 강제**
- **가설**: GPU delegate 생성 시도 자체가 일부 모바일 환경 깨뜨림
- **결과**: 검출 성공 + 부드러움 회복 ✅

### 6. 누끼 모델 데이터 비용 (Step 1 "Failed to fetch")

- **원인**: `isnet_fp16` 모델 ~30MB. 시크릿 탭 + 모바일 데이터에서 타임아웃
- **해결**: `isnet_quint8`로 교체 (~10MB, 메모리도 절반)

### 7. UX 회귀 픽스 (마지막 라운드)

- 펫이 손 밑에 위치 → 팜 anchor를 `[0, 9]` (손목+MCP) →
  `[5, 9, 13]` (MCP 행, 손바닥 위쪽)으로 변경
- "위치 초기화" 버튼 무반응 → 손 인식이 즉시 덮어써서 →
  자동 잠금 추가 → 사용자 거부 → 자동 잠금 제거
- 회전 토글이 다음 컷에서도 켜진 채 남음 → 컷마다 자동 OFF + 회전 상태 초기화
- smoothing 0.35 → 0.55로 lag 감소

### 8. 디버깅 도구 — `?debug=1` 화면 오버레이

USB 디버깅 좌절 후 만든 것 (폰 USB 인식 실패 + 삼성 Auto Blocker 등 환경 장벽).

`?debug=1` 쿼리로 화면 위 디버그 패널:

- `handStatus`, `error`, `point`
- `videoState` (paused, currentTime)
- `pixel(4,4)` (비디오 중앙 RGB 샘플)
- `detect.calls/errors/lastHands/lastAgo`
- User-Agent

→ 폰에서 USB 없이 진단 가능. 결정적 디버깅 도구가 됨.

---

## 📚 기술 스택

### 프론트엔드 코어

- **Next.js 16.2.5** (App Router, Turbopack)
- **React 19.2.4**
- **TypeScript 5**
- **Tailwind CSS 4**

### 상태 관리

- **Zustand 5** — 에디터 4단계 상태 (펫 이미지, 위치, 컷 사진, 프레임 등)

### 카메라/캔버스

- **Konva 10 + react-konva 19** — 합성 스테이지 (펫 + 데코레이션 레이어)
- **use-image** — 이미지 로딩 hook

### AI/ML (런타임 CDN 로드)

- **MediaPipe Tasks Vision — HandLandmarker** `@0.10.18`
  - CDN: `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision`
  - 모델: `hand_landmarker.task` (float16, v1)
    from `storage.googleapis.com/mediapipe-models`
  - Delegate: CPU 강제 / runningMode: VIDEO / numHands: 1
- **@imgly/background-removal 1.7** — 누끼 제거 (모델 `isnet_quint8`)

### 미디어 인코딩

- **gif.js 0.2** — GIF 인코더 (워커 기반)
- **MediaRecorder API** (브라우저 내장) — WebM 영상

### 유틸리티

- **clsx** + **tailwind-merge** — 조건부 클래스
- **lucide-react** — 아이콘

### 테스트/품질

- **Playwright 1.59** — E2E 테스트 (desktop-chromium + mobile-chromium)

### 배포/인프라

- **Vercel** — 자동 배포 (main + develop 브랜치)
- **GitHub** — 소스 관리

---

## 💡 핵심 회고

> **"같은 코드, 같은 URL — 그러나 모바일은 완전히 다른 머신"** 을 체득한 프로젝트.

모바일 웹에서 ML + 카메라 + 캔버스 동시 처리는 데스크톱 가정 그대로 옮기면 깨진다.
라이브러리 호환성, 메모리, CPU, GPU 모든 축에서 모바일 특화 최적화가 필요했고,
**가설을 빠르게 검증하는 인프라(`?debug=1` 패널, Vercel 미리보기 배포 + 14:16 baseline 브랜치)** 가
없었다면 원인 추적이 불가능했을 것.

특히 "공식 MediaPipe Studio 데모도 같은 폰에서 깨진다" 는 외부 검증이
**우리 코드를 의심하던 디버깅 방향을 완전히 바꿨고**,
그 시점이 라이브러리 교체라는 큰 결정의 출발점이 되었다.
