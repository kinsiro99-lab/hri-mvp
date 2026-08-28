# HRI Relation Capture — Technical Note

**Date:** 2026-08-28
**Status:** Beta FREEZE — 아래 내용은 실측 기록이며, Post-Beta 개선 시 출발점으로 사용한다.
**관련 문서:** `docs/HRI_BUSINESS_PHILOSOPHY_DECISION_2026-08-28.md` 4장(Reality Point & Relation Principle)의 구현 현황 각주가 이 문서를 가리킨다. 철학 원칙 자체는 저 문서가 정의하며, 이 문서는 순수하게 기술 실측 기록이다.

---

## 결론 요약

- **Reality Point Separation:** 안정적(여러 차례 반복 재현에서 회귀 없음). FREEZE.
- **Relation storage infrastructure** (`ContextRelation.provenance: "inferred"|"user-stated"`, evidence kind 구분, ReflectionPlan 전달, deterministic fallback 코드): 모두 구현 완료, 정상 동작 확인. FREEZE.
- **User-Stated Relation의 자동 탐지(detection) 안정성:** 확률적(stochastic). Post-Beta 과제로 이월.

---

## 실측 경로 (요약)

같은 Test C 시나리오(T1: 서비스 소개, T2: "인간은 ... 기억하지 못한다", T3: "그래서 바보같은 짓은 반복하기도 한다")에 대해 세 단계로 조사했다:

1. **Prompt 강화** (PHASE 3에 MANDATORY 문구 추가) — 5/5 relation 미형성.
2. **Provenance 스키마 확장 + Deterministic fallback 구현** (`crossElementContinuity` 재사용, 새 LLM call 없음) — 실제 파이프라인 5/5 relation 미형성.
3. **RAW OUTPUT 직접 확인** (interpreter의 정확한 prompt/schema로 OpenAI를 직접 호출, merge 이전 raw 응답 확인) — **relations[] 3/3 비어있음, 그러나 crossElementContinuity는 2/3에서 정상 형성**(priorElementId/groundingQuote/confidence 0.8~0.9 모두 정확).

---

## 핵심 발견

같은 raw 응답 안에서 모델은 "기억하지 못함"과 "반복함"의 연결을 **인식은 하면서도**(`crossElementContinuity`), 그것을 영구적인 `relations[]` 커밋으로는 훨씬 덜 승격시킨다. 즉:

- Prior Evidence는 interpreter 입력에 항상 정상 존재했다(context/input boundary 문제 아님).
- relations[]가 비어있는 것은 merge/runtime 단계가 아니라 **raw output 생성 시점**부터다(merge/wiring 문제 아님).
- 병목은 relations[](PHASE 3, 영구 커밋)와 crossElementContinuity(turn-local, 낮은 bar) 사이의 **비대칭적 보수성** — 모델이 같은 연결에 대해 후자는 더 자주, 전자는 더 드물게 내놓는다.

`buildDeterministicUserStatedRelation()`(현재 코드에 존재, `src/lib/hri/intelligence/intelligenceCore.ts`)은 `crossElementContinuity`가 형성될 때 이를 안전하게(`relatesTo`, `provenance: "user-stated"`, confidence 상향 없음) 영구 relation으로 승격하도록 이미 구현되어 있고, 이번 raw trace의 성공 케이스(2/3)에 대해서는 조건을 모두 만족해 정상 발동했을 것으로 판단된다. 다만 앞선 5회 실제 파이프라인 테스트에서는 0/5였다 — 표본이 작아(5회, 이번 raw trace도 3회) 이 불일치가 우연에 의한 것인지, 파이프라인과 직접 호출 사이의 아직 발견하지 못한 미세한 차이 때문인지는 확정하지 못했다.

---

## Post-Beta 개선 방향 (제안만, 미실행)

다음 세션에서 이 영역을 다시 다룰 경우 참고할 출발점:

1. **더 큰 표본으로 재확인** — 코드 변경 없이, 실제 파이프라인에서 10~15회 이상 반복해 `crossElementContinuity`/`relations[]`의 실제 성공률을 통계적으로 유의미하게 측정. 지금까지의 5회/3회는 결론을 내리기엔 표본이 작다.
2. 그 결과에 따라, crossElementContinuity와 relations[] 사이의 비대칭이 재현된다면 — **PHASE 3 자체를 더 강한 표현으로 다시 미는 것은 이미 실패가 확인된 접근**(§ 이전 Gate)이므로, 대신 "crossElementContinuity가 형성되면 그것으로 충분하다"는 방향(현재 deterministic fallback이 이미 그 방향)을 표본을 늘려 검증하는 쪽이 우선순위가 높다.
3. banned-word 목록 확장이나 새 LLM judge 도입은 이전 세션에서 이미 명시적으로 배제된 접근이며, 이 판단은 유지한다.

---

## Reflection Known Limitation

마지막 실측(Test C 최종 Reflection)의 Sharing에서 "반복하는 행동에 대한 솔직한 표현이었습니다"라는 문구가 나왔다. "솔직한"은 사용자가 직접 쓴 말이 아니지만, 이전에 확인된 명백한 위반들(혼란스러움/복잡함/자기비판/실망 등 뚜렷한 심리 상태 창작)에 비하면 매우 경미한 수식어다. 이번 결정에 따라 validator/banned word/prompt를 이 건으로 다시 수정하지 않는다 — known limitation으로만 기록한다.
