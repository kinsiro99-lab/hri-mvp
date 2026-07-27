# HRI V4 · Step 2 — Presentation Extraction Spec (코드 없음)

방침 확정: `HriSession.tsx`를 복사하지 않는다. 그것이 이미 유일한 Adapter다.
JSX(뷰)만 밖으로 빼낸다. 엔진/상태/전이는 **한 줄도 이동하지 않는다.**

목표 구조:
```
page.tsx (무변경)
  → HriSession.tsx        ← 엔진·세션·상태·ViewModel 소유 (그대로 Adapter)
       → LegacyHriSessionView   ← 순수 표시. 이번에 신설.
       → (later) HriSessionV4View
```

방향: **뷰가 나간다. 로직은 남는다.** 소스 오브 트루스는 계속 하나.

---

## 1. LegacyHriSessionView 정확한 props 인터페이스

현재 JSX가 렌더에 **실제로 참조하는 값과 콜백만** 넘긴다. 계산은 전부
`HriSession.tsx`에 남고, 뷰는 결과만 받는다.

```ts
// src/components/LegacyHriSessionView.tsx 에 함께 둘 타입

import type { Dispatch, SetStateAction } from "react"

// HriSession.tsx의 로컬 타입과 동일 형태를 재사용/재선언
type Phase = "idle" | "thinking" | "question" | "done"

interface Exchange {
  userText: string
  hriResponse: string
}

export interface LegacyHriSessionViewProps {
  // ── 상태 (읽기 전용으로 전달) ──
  phase: Phase
  inputValue: string
  history: Exchange[]
  reflection: string | null
  mainQuestion: string | null      // 현재 항상 null (아래 dead 항목 참조)
  error: string | null

  // ── RuntimePanel용 하드코딩 지표 (엔진 confidence 아님) ──
  runtimeState: string
  confidence: number
  tension: number
  fragmentation: number
  elasticity: number

  // ── 콜백 (핸들러는 전부 Adapter 소유, 뷰는 호출만) ──
  onInputChange: (next: string) => void        // = setInputValue
  onSubmit: (rawText?: string) => void          // = handleSubmit
  onRestart: () => void                         // = handleRestart
}
```

주의:
- `allInputs`, `activeQ`, `questionKey`, `turn` 은 **넘기지 않는다.** 현재 JSX가
  이 값들을 렌더에 쓰지 않기 때문이다. (activeQ는 상태로만 존재, 화면 미표시.)
- `setInputValue`를 그대로 넘겨도 되지만, 뷰 계약을 좁히기 위해
  `onInputChange: (next) => void` 로 감싼다. HriInput의 `onChange`가 이 형태다.
- ViewModel 값들(aurinaState/entries/observation/…)은 **넘기지 않는다.** 현재
  렌더가 안 쓰므로 뷰 계약에 넣지 않는다. (그것들은 V4View의 계약이 된다.)

---

## 2. HriSession.tsx에서 추출할 정확한 JSX 경계

**추출 대상 = `return (...)` 안의 최상위 `<div className="page-shell"> … </div>`
전체.** 단, `if (!BETA_OPEN)` 조기 반환 블록은 **남긴다**(상태 게이트라 Adapter
소유).

경계 시작:
```
return (
  <div className="page-shell">        ← 여기부터
    <section className="hero-zone" …>
    …
```
경계 끝:
```
        <RuntimePanel … />
    </div>                            ← page-shell 닫힘까지
    </div>
  )
```

즉 이동하는 JSX 블록:
- `hero-zone` (AURINA 워드마크 + `aurina-greeting.mp4`)
- `history-area` (history.map)
- `phase === "thinking" && <ThinkingDots/>`
- `reflection-block` (+ mainQuestion 하위 블록)
- `error-msg`
- `phase !== "done" && <HriInput …/>`
- 가운데 빈 `<div>` 및 `restart-btn`
- `bottom-panels` 3카드 + `<RuntimePanel/>`

이 블록 안에서 참조하던 식별자들이 곧 §1의 props가 된다:
`phase, inputValue, history, reflection, mainQuestion, error,
runtimeState/confidence/tension/fragmentation/elasticity,
setInputValue→onInputChange, handleSubmit→onSubmit, handleRestart→onRestart`.

**추출하지 않는 JSX:** `if (!BETA_OPEN) return (<div>…Beta Test Closed…</div>)`.
이 조기 반환은 `HriSession.tsx`에 남는다.

이동에 따라오는 import (뷰 파일로 함께 이동):
- `import HriInput from "./HriInput"`
- `import ThinkingDots from "./ThinkingDots"`
- `import RuntimePanel from "./RuntimePanel"`
경로는 새 파일 위치가 같은 `components/` 이므로 `./` 그대로 유효.

---

## 3. HriSession.tsx에 반드시 남는 상태·콜백

**남는 상태 (전부):**
`phase, inputValue, history, allInputs, activeQ, reflection, mainQuestion,
error, runtimeState, confidence, tension, fragmentation, elasticity,
questionKey`

**남는 콜백/로직 (전부, 무변경):**
- `handleSubmit` (callEngine·nextInputs·phase 전이·분기·catch)
- `handleRestart`
- `handleInputFocus` (현재 미연결 — 그대로 남김, §끝 dead 목록)
- `scrollInputIntoView` (미사용 — 남김)
- ViewModel 계산부 `aurinaState/entries/observation/guideItems/aurinaVoice/
  pattern` (현재 미사용 — 남김. V4View 붙일 때 props로 넘길 예정)
- `callEngine` import, `@/lib/api`
- `BETA_OPEN` 게이트와 `if(!BETA_OPEN)` 조기 반환

**핵심:** 엔진·상태·전이·누적·분기·restart는 100% 제자리. 뷰만 나간다.

---

## 4. 신규 파일 경로

```
src/components/LegacyHriSessionView.tsx
```
(기존 `src/components/HriSession.tsx`는 유지·수정 최소)

---

## 5. HriSession.tsx에 필요한 import 변경

**추가:**
```ts
import LegacyHriSessionView from "./LegacyHriSessionView"
```

**이동(삭제 후 뷰 파일로):**
```ts
import HriInput from "./HriInput"          // 이동
import ThinkingDots from "./ThinkingDots"  // 이동
import RuntimePanel from "./RuntimePanel"  // 이동
```
→ `HriSession.tsx`에서 이 3개 import가 더 이상 직접 쓰이지 않으므로 제거.
   (뷰 파일이 대신 가져간다.)

**주 반환부 교체 (개념, 코드 아님):**
```
return (
  <div className="page-shell"> …전체 JSX… </div>
)
```
↓
```
return (
  <LegacyHriSessionView
    phase={phase}
    inputValue={inputValue}
    history={history}
    reflection={reflection}
    mainQuestion={mainQuestion}
    error={error}
    runtimeState={runtimeState}
    confidence={confidence}
    tension={tension}
    fragmentation={fragmentation}
    elasticity={elasticity}
    onInputChange={setInputValue}
    onSubmit={handleSubmit}
    onRestart={handleRestart}
  />
)
```
`if(!BETA_OPEN)` 조기 반환은 이 위에 그대로 유지.

**변경 없음:** 상태 선언, 핸들러, ViewModel 계산부 전부.

---

## 6. 컴파일 검증 명령

```bash
# 타입/컴파일 (프로젝트 루트)
npx tsc --noEmit

# 빌드까지 확인하려면
npm run build         # 또는 next build

# 경계 검증 — callEngine이 뷰로 새지 않았는지
grep -n "callEngine\|@/lib/api" src/components/LegacyHriSessionView.tsx
# 기대: 빈 결과

# 엔진 로직이 뷰에 복제되지 않았는지
grep -n "advanceSession\|HRI_V2\|planQuestionDecision\|handleSubmit\b" src/components/LegacyHriSessionView.tsx
# 기대: 빈 결과 (onSubmit prop 호출만 있어야 함)

# HriSession이 여전히 유일한 엔진 진입점인지
grep -rn "from \"@/lib/api\"" src/components/
# 기대: HriSession.tsx 한 줄만
```

---

## 7. 런타임 동작 체크리스트 (behavior 동일 증명)

추출 후 화면·동작이 **완전히 같아야** 한다. 순서대로 확인:

1. 초기 로드 — hero-zone(AURINA 영상) + 하단 3카드 표시, 입력창 포커스
2. 첫 입력 제출 — thinking dots 표시 → 질문 반환 → history-area에 누적
3. 연속 3~4턴 — 이전 교환이 history-area에 쌓임 (재생 모델 정상)
4. 종료 턴 — reflection-block(흐름 요약) 표시, 입력창 사라짐
5. mainQuestion — 항상 미표시 (엔진이 null 설정 — 기존과 동일)
6. 에러 — 네트워크 차단 시 error-msg 표시 + 입력 재활성
7. 새로 시작 — restart-btn → 전체 초기화, idle 복귀
8. RuntimePanel — 하드코딩 값(0.714 등) 그대로 표시
9. 한글 IME — 조합 중 Enter로 잘림 없음 (HriInput 기존 동작 유지)
10. `aurina-greeting.mp4` 자동재생·루프 유지

하나라도 다르면 추출 경계가 틀린 것 → §8로 롤백.

---

## 8. 원스텝 롤백

```bash
# HriSession.tsx의 반환부를 이전 JSX로 되돌리고
# 새 파일을 지운다 (import도 원복)
git checkout -- src/components/HriSession.tsx
rm src/components/LegacyHriSessionView.tsx
```
또는 커밋 전이면 편집기 Undo 한 번. `page.tsx`는 안 건드렸으므로 롤백 대상 아님.

---

## 9. page.tsx 무변경 확인

`page.tsx`는 여전히:
```tsx
import HriSession from "@/components/HriSession";
export default function Home() {
  return (<main className="hri-main"><HriSession /></main>)
}
```
Step 2에서 **손대지 않는다.** `HriSession`이 내부적으로 뷰를 위임할 뿐,
외부 계약(default export 컴포넌트)은 동일.

---

## 10. controller / engine 무변경 확인

이동·수정 대상 파일 목록에 아래는 **없다:**
```
src/lib/hri/controller.ts          ← 무변경
src/lib/hri/sessionAdapter.ts      ← 무변경
src/lib/hri/v2/understandingEngine.ts
src/lib/hri/v2/questionPlanner.ts
src/lib/hri/v2/selector.ts
src/lib/api (callEngine)           ← import 위치 무변경 (HriSession에 그대로)
```
Step 2는 `components/` 안에서만 일어난다. 서버·엔진 경로는 접촉 0.

---

## 기록: 현재 dead / disconnected (제거하지 않음)

Step 2에서 **건드리지 않고 그대로 둔다.** 정리는 별도 단계에서 결정.

- `BETA_PASSWORD` — 사용처 없음.
- `handleInputFocus` — 정의만, JSX 미연결.
- `scrollInputIntoView` — 정의만, 미사용.
- `nextMainQuestion` — reflection 분기에서 계산되나 `setMainQuestion(null)`로
  덮여 화면에 안 나옴. → `mainQuestion` prop은 뷰에 전달하되 항상 null.
- `aurinaState, entries, observation, guideItems, aurinaVoice, pattern` —
  계산되나 현재 렌더 미사용. **남긴다.** V4View 연결 시 그대로 props로 승격.
- `RuntimePanel` 지표(`confidence/tension/fragmentation/elasticity`) —
  하드코딩 UI 값. **엔진 confidence 아님.** V4의 maturity와 혼동 금지.

이들은 Step 2 이후에도 살아있는 채로 남아, V4View 연결 단계에서 각자
목적지(ViewModel→V4View props, dead→정리)로 이동한다.

---

## 다음 액션

이 스펙 승인 시 실제 Step 2를 제출한다:
- `LegacyHriSessionView.tsx` 전체 (현재 JSX를 props 기반으로 옮긴 완전 코드)
- `HriSession.tsx`의 정확한 FIND/REPLACE (import 3줄 이동 + 반환부 교체)
- §6 grep/tsc 결과 체크리스트

엔진·controller·질문 흐름·page.tsx: 전부 무변경.
