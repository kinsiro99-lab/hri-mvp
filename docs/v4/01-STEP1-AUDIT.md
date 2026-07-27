# HRI V4 · Step 1 — Audit-First (코드 없음)

실물 `HriSession.tsx` 하나만 기준으로 분석한다. 엔진·controller·질문 흐름은
건드리지 않는다. 이 문서가 확정되기 전에는 로직을 이동하지 않는다.

---

## 0. 가장 중요한 발견

현재 `HriSession.tsx`는 **이미 V3 어댑터 변환 코드를 품고 있으나, 그 결과를
화면에 쓰지 않는다.**

- 파일 안에 `aurinaState`, `entries`, `observation`, `guideItems`,
  `aurinaVoice`, `pattern` 이 계산되어 있다. (V3 어댑터 잔재)
- 그러나 `return`은 이 값들을 **하나도 사용하지 않고**, 옛
  `hero-zone + history-area + reflection-block + bottom-panels` JSX를 렌더한다.
- 즉 **계산은 죽은 코드(dead adapter), 렌더는 옛 UI**다.

→ Step 1의 목표가 명확해진다. 로직을 옮기는 게 아니라, **이미 존재하는
   변환 코드와 실제 렌더를 분리해 경계를 긋는 것**이다. 이건 이동보다 안전하다.

또 하나: import `import type { ... } from "./hri/v3/types"` 가 이미 있다.
V3 타입은 프로젝트에 존재한다. 하지만 `HriSessionView`는 참조되지 않는다
(현재 파일은 그것을 import하지 않는다). 사용자 확인과 일치한다.

---

## 1. HriSession.tsx의 모든 책임 분류

파일을 위에서 아래로 훑어 실제 존재하는 것만 분류한다.

### A. Engine / controller orchestration — 절대 이동 금지, 무변경
- `import { callEngine } from "@/lib/api"` — 유일한 엔진 진입점
- `handleSubmit` 내부:
  - `nextInputs = [...allInputs, text]` — 입력 누적(재생 모델의 핵심)
  - `await callEngine({ turn: nextTurn, inputs: nextInputs })`
  - `result.reflection` / `result.question` / `result.mainQuestion` 분기
  - 각 분기의 `setHistory / setActiveQ / setReflection / setPhase` 전이
  - `catch` → `setError` + phase 복귀
- `handleRestart` — 전체 상태 초기화

이 블록이 controller/understandingEngine과 맞물린 계약이다. **한 줄도 옮기거나
바꾸지 않는다.**

### B. Session state (엔진 구동 상태) — 초기엔 그대로 보존
- `phase, inputValue, history, allInputs, activeQ, reflection, mainQuestion, error`
- `questionKey` (CSS fade 트리거)
- `turn = allInputs.length`

핵심 상태다. Adapter가 이걸 소유해야 한다(엔진과 맞물리므로).

### C. Adapter logic (엔진 상태 → View 타입) — 이미 존재, 현재 미사용
- `aurinaState` 계산 (phase → resonating/reflecting/observing)
- `entries` 계산 (history → TimelineEntry[])
- `observation` 계산 (reflection → { core })
- `guideItems` 배열 (하드코딩)
- `aurinaVoice` 계산
- `pattern = null`

**이미 어댑터다.** 다만 렌더가 안 쓴다. Step 1에서 이 조각들이 Adapter 경계의
씨앗이 된다.

### D. Presentation-only JSX — 미래 교체 대상 (지금은 유지)
- `hero-zone` (AURINA 워드마크 + `aurina-greeting.mp4` 영상)
- `history-area` (과거 교환 렌더)
- `reflection-block` (흐름 요약 + mainQuestion)
- `error-msg`
- `bottom-panels` (3카드: AURINA / CURRENT·RHYTHM·MIRROR / RuntimePanel)

### E. Layout — D에 섞여 있음
- `page-shell` 래퍼, `hero-zone`의 인라인 grid, `bottom-panels`의 인라인 grid

현재 layout은 JSX 인라인 스타일에 박혀 있다(별도 레이아웃 컴포넌트 없음).

### F. Runtime visualization — 하드코딩, 엔진과 무관
- `runtimeState, confidence, tension, fragmentation, elasticity` (useState 상수)
- `<RuntimePanel .../>`
- **엔진이 갱신하지 않는다.** 표시용 더미. (V4에서 maturity와 혼동 금지 —
  이건 confidence가 아니라 하드코딩 상수다.)

### G. Observation rendering — 현재는 D의 일부
- `reflection-block`이 사실상 유일한 관찰 표시. 별도 Observation 컴포넌트 없음.

### H. Input
- `<HriInput value onChange onSubmit placeholder disabled autoFocus />`
- `handleSubmit(rawText?)` — HriInput이 텍스트를 넘길 수 있게 이미 시그니처가
  `(rawText?: string)`로 바뀌어 있다. (V3 InputBar와 호환되는 형태)

### I. History
- `history` state + `history-area` JSX 렌더. **이것이 미래의 Evidence Layer다.**

### J. Restart
- `handleRestart` + `restart-btn`

### K. Legacy / 현재 미사용 — 지금 제거 금지
- `scrollInputIntoView()` 함수 정의됨 — 그러나 `handleInputFocus`는 정의만 되고
  JSX 어디에도 연결 안 됨. **죽은 코드지만 Step 1에서 건드리지 않는다.**
- `BETA_PASSWORD` 상수 — 사용처 없음. 유지.
- C의 어댑터 계산 6종 — 죽은 코드. 유지(경계의 씨앗).
- `nextMainQuestion` — `handleSubmit` reflection 분기에서 계산되나 사용 안 됨.
  유지.

---

## 2. 단일 파일 → 다중 컴포넌트 분할 제안 (behavior 동일 보존)

목표 최종 형태 (Step 1에서 전부 하지 않는다 — 지도일 뿐):

```
HriSession.v4-adapter.tsx   [A][B][C][F] 엔진·상태·변환 소유. 렌더는 위임.
   └─ renders one of:
        (Step 1) 기존 JSX 그대로  ← 지금은 이걸 유지
        (later)  <ObservationExperience>  [D][E][G][H][I][J]
                    ├─ Stage
                    ├─ EvidencePanel        ← history [I]
                    ├─ ObservationWorkspace ← reflection→observation [G]
                    ├─ (DerivedOutputs)     ← 미래
                    └─ Compose              ← HriInput [H] + restart [J]
```

분할 원칙: **엔진과 맞물린 A/B/C/F는 Adapter에 남고, D/E/G/H/I/J만 아래로
내려간다.** Runtime visualization(F)은 하드코딩이므로 Adapter에 남기되 V4
화면에서는 렌더하지 않는다(상태는 보존).

---

## 3. 의존 다이어그램 (엔진 의존 vs 표시 전용)

```
                    @/lib/api (callEngine)      @/lib/hri/controller
                          ▲                     (callEngine 내부에서만)
                          │ 유일한 호출
              ┌───────────┴────────────┐
              │  HriSession.v4-adapter  │  ← 엔진 의존 (유일)
              │  [A] orchestration      │
              │  [B] session state      │
              │  [C] engine→View 변환    │
              │  [F] runtime 상수(보존)  │
              └───────────┬────────────┘
                          │ View props만
              ┌───────────┴────────────┐
              │  (Step 1) 기존 JSX      │  ← 표시 전용
              │  (later) Observation-   │
              │          Experience     │
              └─┬─────┬─────┬─────┬────┘
                ▼     ▼     ▼     ▼
             Stage Evidence Work- Compose   ← 전부 엔진 의존 NONE
                          space
```

`hri/v3/types.ts` 는 양쪽이 공유하는 순수 타입(값 아님)이라 경계를 위반하지
않는다.

---

## 4. Adapter 경계 정의

**Adapter 안에 남는 것 (엔진과 계약):**
- `callEngine` import 및 호출
- `handleSubmit`, `handleRestart` 전체
- 모든 session state (B) + runtime 상수 (F)
- 엔진 상태 → View 타입 변환 (C)
- `BETA_OPEN` 게이트

**Presentation으로 내려가는 것 (엔진 모름):**
- hero/AURINA 표현 → `Stage`
- `history-area` → `EvidencePanel`
- `reflection-block` → `ObservationWorkspace` / `FlowSummary`
- `HriInput` + `restart-btn` → `Compose`
- `bottom-panels` 3카드 → 폐기 또는 Guide/Observation로 흡수 (미래 결정)
- `RuntimePanel` → V4 화면에서 미렌더 (상태는 Adapter에 보존)

경계 판정 한 줄: **`callEngine`/`set*`를 만지면 Adapter, 아니면 Presentation.**

---

## 5. Migration plan (각 단계 컴파일 성공 + behavior 보존, 엔진 무변경)

**Step 1 (이번) — Adapter shell만, 렌더·동작 무변경.**
- 새 파일 `HriSession.v4-adapter.tsx` 를 만들지 **않는다** (아직).
- 대신 현재 `HriSession.tsx` 안에서 **[A][B][C][F] 와 [D] 렌더 사이에 주석
  경계선 하나**를 긋는다. 코드 이동 0, 로직 변경 0.
- 목적: 다음 단계에서 잘라낼 선을 파일 안에 명시. 컴파일·동작 100% 동일.
- (원한다면 Step 1을 "주석 경계선"조차 없이 **순수 audit로 끝내고**, 실제
  파일 수정은 Step 2부터 시작할 수도 있다. 더 안전한 쪽을 택하라.)

**Step 2 — Adapter 파일 신설, 기존 JSX를 그대로 담아 렌더.**
- `HriSession.v4-adapter.tsx` 생성. 현재 파일의 [A][B][C][F]+기존 JSX를
  **그대로 복사**(이동 아님, 복사). `page.tsx`는 아직 기존 `HriSession` 유지.
- 두 파일이 동일 동작. 새 파일은 아직 아무 데서도 import되지 않음 → 위험 0.

**Step 3 — page.tsx import만 교체 + 즉시 롤백 경로 확인.**
- `import HriSession from "@/components/HriSession"` →
  `"@/components/HriSession.v4-adapter"`. 화면 동일해야 정상.

**Step 4~ — 기존 JSX를 컴포넌트로 하나씩 추출** (Evidence → Workspace →
Stage → Compose 순), 매 단계 화면 비교. 여기서부터 V4 아키텍처 문서의
로드맵과 합류.

Step 1은 **위 중 첫 줄만**이다.

---

## 6. 절대 이동/변경 금지 (NEVER)

- `callEngine` 호출과 그 인자 `{ turn, inputs }`
- `handleSubmit`의 입력 누적 `nextInputs` 및 phase 전이 순서
- `result.reflection` / `result.question` 분기 로직
- `handleRestart`의 초기화 집합
- `history` / `allInputs`의 의미 (재생 모델 — sessionAdapter가 매 요청 전체
  재생하므로 `allInputs` 누락은 세션 붕괴)
- `phase` 값의 문자열 (`idle/thinking/question/done`) — 엔진 응답 해석과 결합

이들은 controller.ts의 계약과 직접 맞물린다. UI 작업 중 절대 손대지 않는다.

---

## 7. 독립 컴포넌트화가 안전한 JSX 섹션

behavior 없이 순수 표시라 안전한 것:
- `hero-zone` 블록 → `Stage` (상태 입력만 받음)
- `history-area` 블록 → `EvidencePanel` (history 배열만 받음)
- `reflection-block` 블록 → `ObservationWorkspace` (reflection 문자열만 받음)
- `bottom-panels`의 좌/중 카드 → 정적, 언제든 분리 가능
- `restart-btn` → `Compose`에 흡수 또는 독립 버튼

주의가 필요한 것(behavior 얽힘):
- `HriInput` — `handleSubmit`·`inputValue`와 결합. controlled로 넘기되
  핸들러는 Adapter가 소유 (V3에서 검증한 패턴).
- `RuntimePanel` — props가 하드코딩 상수. 분리는 되나 V4에서 미렌더 권장.

---

## 8. 실제 경로 요약 (사용자 확인 기준)

**1) 실제 active 렌더 경로**
```
app/page.tsx → <HriSession/> (@/components/HriSession)
   → return: hero-zone + history-area + reflection-block + bottom-panels
   (C의 어댑터 계산은 렌더에 미사용 = dead)
```

**2) 현재 엔진 호출 경로**
```
handleSubmit → callEngine({turn,inputs}) [@/lib/api]
   → (서버) /api/analyze → getNextOutput → runHriSession(sessionAdapter)
      → advanceSession(controller.ts) → HRI_V2 블록
```
controller.ts는 이미 확인됨: `HRI_V2=true` 블록만 실행, `lastProbedSlot`
재주입·`NEUTRAL_DEEPENING` fallback·`planQuestionDecision` 모두 반영된 최신 상태.

**3) 제안 Adapter 경계**
`HriSession.v4-adapter.tsx` = [A]orchestration + [B]state + [C]변환 + [F]상수.
Presentation = 나머지 JSX. 경계 판정: `callEngine`/`set*` 접촉 여부.

**4) 정확한 신규 파일 경로 (Step 2에서 생성, Step 1은 생성 안 함)**
```
src/components/HriSession.v4-adapter.tsx
```
(기존 `src/components/HriSession.tsx` 는 유지 — 덮어쓰지 않음)

**5) HriSession.tsx에 남는 것 (Step 1 이후)**
전부 그대로. Step 1은 파일을 바꾸지 않거나(순수 audit), 주석 경계선 한 줄만
추가한다.

**6) 나중에 Adapter로 이동할 수 있는 것**
[A][B][C][F] 전체 → `HriSession.v4-adapter.tsx` (Step 2에서 복사).

**7) controller/engine 중복 안 됐는지 검증 grep**
```
# callEngine은 오직 한 곳(어댑터)에서만 import돼야 한다
grep -rn "from \"@/lib/api\"" src/components/
grep -rn "callEngine" src/components/

# controller/understandingEngine을 UI가 직접 import하지 않았는지
grep -rn "lib/hri/controller\|understandingEngine\|questionPlanner\|sessionAdapter" src/components/

# advanceSession/controller 로직이 복제되지 않았는지 (컴포넌트 폴더에 있으면 안 됨)
grep -rn "advanceSession\|HRI_V2\|planQuestionDecision" src/components/
```
기대: 처음 두 개는 어댑터 파일에서만, 나머지는 **빈 결과**.

**8) 원라인 롤백**
```
# page.tsx의 import 한 줄만 되돌린다
import HriSession from "@/components/HriSession";   // ← 원복
```

---

## 결론 / 다음 액션

Step 1은 **audit로 끝내는 것을 권장**한다. 실제 파일 수정은 Step 2(어댑터
파일 복사 생성)부터 시작하면, 기존 `HriSession.tsx`가 손대지 않은 채 남아
가장 안전한 롤백 지점이 된다.

승인하면 Step 2를 다음처럼 제출한다:
- `HriSession.v4-adapter.tsx` 전체 (현재 파일의 정확한 복사 + 주석 경계선)
- `page.tsx` FIND/REPLACE 1줄
- 위 grep 8종 실행 결과 체크리스트

엔진·controller·질문 흐름은 어느 단계에서도 건드리지 않는다.
