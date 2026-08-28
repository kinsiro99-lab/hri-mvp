# HRI Business & Philosophy Decision

**Date:** 2026-08-28
**Status:** 확정 (Decision Record)
**Scope:** 이 문서는 HRI의 사업 정의와 철학적 원칙을 기록하는 결정문이다. Runtime 코드의 실시간 구현 상태를 추적하는 문서가 아니다 — 이 문서가 서술하는 원칙 중 일부(특히 4장 Reality Point & Relation Principle)는 이 날짜 기준으로 **원칙은 확정됐지만 실제 구현/실측 결과는 아직 불안정**하다. 실제 구현 상태는 항상 코드와 커밋 기록이 우선하며, 이 문서는 "무엇을 지향하는가"를 기록한다.

이 문서는 `docs/ObservationOS.md`(HRI Vitality Model), `docs/QuestionEvolution.md`(Question Evolution Engine)와 병존한다. 두 문서를 대체하거나 수정하지 않으며, 아래 6장/9장은 그 두 문서를 더 상위의 철학적 맥락에서 참조·연결한다.

---

## 1. HRI의 사업 정의

HRI는 **Human Reality Intelligence Service**다.

HRI는 사람을 분석하거나 평가하는 서비스가 아니다. 진단하지 않고, 점수를 매기지 않고, 사용자를 유형화하지 않는다.

HRI가 하는 일은 하나다: **사용자가 자신의 Reality와 그 안에서 나타나는 흐름을 스스로 발견하도록 돕는 것.**

이 서비스의 핵심 가치는 다음 한 문장으로 요약된다:

> **핵심 가치 = Self-Discovery Quality**

HRI가 얼마나 많이 말했는지, 얼마나 유창하게 반응했는지는 사업적 가치가 아니다. 사용자가 대화를 마친 뒤 "아, 내가 이걸 말하고 있었구나"를 스스로 발견했는지가 유일한 가치 척도다.

---

## 2. 마음의 거울의 정의

마음의 거울(HRI의 한국어 제품명, AURINA가 이 역할을 수행)은 채팅방이 아니다.

> "마음의 거울은 채팅방이 아닙니다. 당신 자신을 바라보기 위한 마음의 창입니다." (`src/lib/i18n/content.ts`, 사용자에게 실제로 노출되는 문구)

HRI는 챗봇이 아니라 **Observation Operating System**이다.

- Question은 목표가 아니다.
- Observation이 목표다.
- Reflection은 Observation의 결과다.

마음의 거울은 사용자가 스스로에게 이야기하는 것을 HRI가 되비추는 자리이지, HRI가 사용자와 "대화"를 나누는 자리가 아니다. 이 구분이 HRI의 모든 질문 설계와 Reflection 설계의 출발점이다.

---

## 3. Grounded Reflection Principle

오늘(그리고 이번 세션 전체에 걸친 실측 기반 작업)을 통해 확정된 HRI의 핵심 원칙이다. 실제 코드로는 `src/lib/hri/intelligence/finalExperiencePhraser.ts`의 `buildDiscoveryText()`/`validateFinalExperience`에 구현되어 있다.

**핵심 규칙:**

- **Evidence가 없으면 만들어내지 않는다.**
- **Evidence가 있으면, Evidence가 실제로 보여주는 흐름을 발견한다.**

이 두 규칙은 HRI의 Reflection을 두 가지 역할로 나눈다:

| 상황 | 역할 |
|---|---|
| Explicit-only (연결 Evidence 없음) | **Grounded Acknowledgement** — 사용자가 말한 것을 있는 그대로 조심스럽게 받아들인다. 새 감정/가치/의미를 만들지 않는다. |
| Relation / Change / Structure (검증된 연결 Evidence 있음) | **Grounded Discovery** — Evidence가 실제로 증명하는 관계·변화·구조를 발견해서 말할 수 있다. |

중요한 것은 "Discovery"라는 이름이 절대로 "Evidence를 출발점으로 새로운 감정/가치/의미를 만들어도 된다"는 뜻이 아니라는 점이다. Discovery는 오직 **Evidence가 이미 증명한 것을 발견해서 표현하는 것**이지, HRI가 상황의 종류(situation-type)로부터 그럴듯한 감정·교훈·위로를 지어내는 것이 아니다.

이 원칙은 실사용자 테스트에서 반복적으로 검증됐다: Evidence 밖의 "그리움", "소중함", "특별함" 같은 attribution이 discovery 타입 Reflection에서 새어 나오는 것이 확인됐고(2026-08-28 세션), 이를 막기 위해 explicit-only는 Grounded Acknowledgement로, discovery 타입은 Grounded Discovery Boundary로 각각 프롬프트 수준에서 명시적으로 경계를 그었다. 이 경계는 새 금지 단어 목록을 계속 늘리는 방식(whack-a-mole)이 아니라, **모델에게 허용된 claim의 범위 자체**를 좁히는 방식으로 구현됐다 — 이 판단은 향후에도 유지된다.

---

## 4. Reality Point & Relation Principle

> **Beta 구현 현황 (원칙과 구분):** 이 원칙은 철학적으로 확정되어 있고, 이를 표현·저장·전달하는 구조(Reality Point 분리, `ContextRelation.provenance`의 `inferred`/`user-stated` 구분, ReflectionPlan으로의 provenance 전달, Grounded Discovery Boundary)는 Beta에서 이미 완성되어 FREEZE됐다. **Beta에서는 Reality Point 보존을 우선한다. User-Stated Relation은 구조적으로 지원하지만, 자동 포착의 완전한 안정성은 Post-Beta 개선 과제로 둔다. Evidence가 불확실한 경우 HRI는 관계를 추정해 만들지 않는다.** 이것은 원칙의 미완성이 아니라 Beta 범위의 의도적 제한이다 — 실측 TRACE는 `docs/HRI_RELATION_CAPTURE_TECHNICAL_NOTE_2026-08-28.md` 참조.

**핵심 구분 1 — 같은 Reality의 강화 vs 새로운 Reality Point**

사용자의 새 발화가 이전 발화와 관련이 있다는 사실만으로 같은 Reality Point가 되는 것은 아니다.

- 기존 Reality Point의 **상태·강도·명세**가 갱신되는 경우 → 같은 Reality Point의 강화(reinforce)
- 이전 Point 때문에/그 결과로 **새로운 상태·행동·결과·사건·판단**이 생겼다면 → 그것은 강화가 아니라 **두 번째의 독립된 Reality Point**이며, 그 사이의 관계는 별도로 검토해야 한다.

**핵심 구분 2 — 사용자가 직접 제시한 Line을 놓치지 않는다**

사용자가 자신의 발화 안에서 두 Reality Point 사이의 연결을 직접 제시했다면(예: "그래서", "때문에", 또는 명시적 접속사 없이도 내용상 분명한 연결), HRI는 그 연결(Line)을 놓치지 않고 보존해야 한다. 이것은 keyword 매칭이 아니라 **실제 내용이 연결을 주장하고 있는가**에 대한 판단이다.

**핵심 구분 3 — User-Stated Relation과 HRI Inferred Relation 구분**

HRI가 보존해야 하는 것은 객관적 causal truth("A가 실제로 B의 원인이다")가 아니다. HRI가 보존해야 하는 것은 다음 사실이다:

> "사용자가 자신의 Reality 안에서 두 Point를 이렇게 연결해서 말했다."

이를 위해 `ContextRelation.provenance`를 두 값으로 구분한다:

- **`inferred`** — HRI가 두 Reality Point 사이의 관계를 스스로 추론함.
- **`user-stated`** — 사용자가 자신의 발화 안에서 두 Reality Point를 직접 연결해서 제시함.

`user-stated`는 새로운 causal truth를 주장하는 것이 아니다. "A가 객관적으로 B의 원인이다"를 의미하지 않는다. 오직 "사용자는 A와 B를 연결해서 말했다"는 Evidence다. Reflection이 이 구분을 관계의 진실성 판정으로 확대해서는 안 된다 — 관계의 방향과 강도는 항상 사용자가 실제로 표현한 수준을 넘지 않는다.

---

## 5. Short Conversation Principle

HRI의 대화는 기존 5~7 Turn 중심에서 **4~5 Turn 중심**으로 발전한다.

- 대화가 짧아질수록 **각 Evidence 하나하나의 중요성이 커진다.** 놓친 Evidence를 나중 turn에서 만회할 여지가 줄어들기 때문이다.
- 목표는 더 많은 질문이 아니라, **적은 질문으로 중요한 Evidence를 발견하는 것**이다.
- Evidence가 부족한 상태에서 **억지로 Discovery를 만드는 것은 금지**된다. 이는 3장 Grounded Reflection Principle과 직접 연결된다 — 짧은 대화일수록 explicit-only로 끝나는 것이 정상이고 정직한 결과이며, 실패가 아니다.

---

## 6. Question Evolution 방향

질문의 수를 늘리는 것은 목적이 아니다. HRI의 질문이 지향해야 하는 것은:

- **아직 확인되지 않은 중요한 Evidence를 드러내는 질문.**
- **Information Gain**(질문이 실제로 Understanding에 새로운 것을 더했는가)과 **Self-Discovery**(사용자가 스스로 무언가를 발견했는가)를 중시하는 질문.

이 방향성의 구체적인 평가·진화 메커니즘(Question Identity, Question Memory, Retire/Improve/Split/Merge/Create Variant/Prioritize 등 6가지 제안 유형, 일일 Evolution Report)은 이미 `docs/QuestionEvolution.md`에 상세히 정의되어 있으며, 이 문서는 그 메커니즘을 재정의하지 않는다. 이 장은 그 메커니즘이 따라야 할 상위 철학 — "질문의 존재 이유는 질문 자체가 아니라 사용자의 Self-Discovery"라는 원칙을 명시하는 것이 목적이다.

---

## 7. 사용자 데이터 원칙

**원칙 1 — User-Stated Evidence와 HRI Inference 분리**

사용자가 직접 말한 것과 HRI가 추론한 것은 데이터 구조상 항상 구분되어 저장된다. 이 세션에서 실제로 구현/확장된 두 가지 필드가 이 원칙의 구체적 표현이다:

- `EvidenceRef.kind`: `"explicit"` (사용자의 문자 그대로의 말) vs `"inferred"` (HRI의 해석)
- `ContextRelation.provenance`: `"user-stated"` vs `"inferred"` (4장 참조)

**원칙 2 — 데이터 흐름**

```
Identity → Session → Evidence → Reality Point/Relation → Reflection → Observation → Long-term Memory
```

각 단계는 이전 단계가 실제로 검증한 것만 다음 단계로 넘긴다. 검증되지 않은 추론이 다음 단계에서 마치 확정된 사실처럼 취급되지 않도록 하는 것이 이 흐름의 존재 이유다.

**원칙 3 — HRI의 추론을 사용자에 대한 영구 사실로 굳히지 않는다**

HRI가 그 turn에만 사용하는 약한 신호(예: `crossElementContinuity` — turn-local 대화 연속성 신호)는 의도적으로 **영구 저장되지 않는다.** ContextGraph에 영구 저장되는 것은 검증을 거친 Evidence·Element·Relation뿐이며, 그마저도 `provenance`로 "이것이 사용자의 말인지 HRI의 해석인지"를 항상 구분해 표시한다. HRI는 자신의 순간적인 판단을 사용자에 대한 고정된 사실로 축적하지 않는다.

---

## 8. HRI의 장기 사업적 자산

HRI가 시간이 지나며 축적하는 자산은 다음 다섯 가지다:

1. **Grounded Human Reality Evidence** — 사용자가 실제로 말한, 검증 가능한 Reality 기록.
2. **Reality Structure** — Reality Point들 사이의 관계 구조(4장의 User-Stated/Inferred Relation).
3. **Question Quality Evidence** — 어떤 질문이 실제로 좋은 Discovery로 이어졌는지에 대한 축적된 기록(`docs/ObservationOS.md`의 Vitality Model, `docs/QuestionEvolution.md`의 Question Memory).
4. **Reflection Quality Evidence** — 어떤 Reflection이 사용자에게 실제로 의미 있었는지에 대한 기록.
5. **Question Evolution** — 위 자산들이 누적되어 HRI의 질문 자체가 시간이 지나며 더 나아지는 과정.

이 다섯 가지는 단순한 데이터 축적이 아니라, HRI라는 서비스 자체의 경쟁력이 시간이 지날수록 깊어지는 근거다.

---

## 9. HRI Evolution Principle

HRI는 스스로 진화하지만, 그 진화는 항상 다음 순서를 따른다:

```
Observation → Evaluation → Evolution Proposal → Human Approval → 적용
```

- **Observation**: 완료된 세션에서 무엇이 일어났는지 기록한다.
- **Evaluation**: 그 기록을 평가한다(`docs/ObservationOS.md`의 Vitality Model — Question Quality/Answer Quality/Reality Response/Learning/Growth).
- **Evolution Proposal**: 평가로부터 구체적인 변경 제안을 만든다(`docs/QuestionEvolution.md`의 Retire/Improve/Split/Merge/Create Variant/Prioritize).
- **Human Approval**: 모든 제안은 사람의 승인 전까지 비활성 상태다. HRI가 스스로 결정하지 않는다.
- **적용**: 승인된 제안만 별도의 구현 스프린트로 실제 코드에 반영된다.

**Evolution이 Runtime을 직접 변경하지 않는다.** 이 문장은 이번 세션 전체에서 반복적으로 지켜진 원칙이기도 하다 — 이 세션에서 이루어진 모든 구조 조사와 코드 수정은 매 단계 사용자의 명시적 승인을 거쳤으며, 어떤 관찰이나 제안도 승인 없이 스스로 Runtime에 반영되지 않았다.

---

## 10. 최종 선언

> HRI는 사람을 대신해서 해석하는 시스템이 아니다.
> 사람이 자신의 Reality를 발견하도록 돕는 시스템이다.
>
> HRI는 모든 점을 연결하지 않는다.
> 점을 놓치지 않고, 사용자가 연결을 보여주었을 때
> 그 선을 보존한다.
>
> 좋은 HRI는 더 많이 말하는 HRI가 아니다.
> 근거가 없는 곳에서는 멈출 줄 알고,
> 근거가 나타난 곳에서는 그 흐름을 놓치지 않는 HRI다.
>
> HRI는 사용자의 성장을 돕는 동시에
> 스스로의 질문도 진화시킨다.
> 모든 대화는 HRI의 새로운 생명력이 되어
> 내일의 더 나은 질문으로 이어진다.

---

## 11. Predictable Risks & Fundamental Solutions

오늘 확인한 "향후 예측 가능한 HRI 문제"를 단순 Known Limitation 목록이 아니라, **Risk → Root Cause → Fundamental Solution → Development Stage** 형태의 장기 설계 기준으로 기록한다.

### 11.1 User-Stated Relation Detection Instability

**Risk:** Reality Point는 보존되어도 사용자가 직접 말한 Point 사이의 연결을 놓칠 수 있다.

**Observed:** `relations[]`와 `crossElementContinuity` 모두 LLM의 실행별 확률성 영향을 받는다.

**Root Cause:** 사용자가 이미 제시한 연결의 보존까지 LLM의 semantic judgment에 의존하고 있다.

**Fundamental Solution:** 장기적으로 "User-Stated Evidence Capture"와 "HRI Inference"를 분리한다. 사용자가 직접 제시한 연결은 Evidence Layer에서 보존하고, 그 관계의 의미·종류에 대한 판단만 Interpretation Layer가 담당한다. 즉:

```
User Statement → Evidence Capture → Reality Point / User-Stated Connection → Interpretation → Reflection
```

구조를 목표로 한다. 단순 connector keyword table로 해결하지 않는다.

### 11.2 False Relation Risk

**Risk:** Relation recall을 높이려다 실제로 존재하지 않는 Line을 만들 수 있다.

**Root Cause:** 언어적 연결 표현과 실제 의미적 연결을 동일시할 위험.

**Fundamental Solution:** Relation에는 provenance와 confidence뿐 아니라 "확정되지 않음"을 정상 상태로 허용한다.

HRI 원칙: **False Positive Relation보다 Unresolved Relation이 안전하다.** Evidence가 부족하면 Line을 만들지 않는다.

### 11.3 Short Conversation Evidence Loss

**Risk:** 4~5 Turn에서는 한 번 중요한 Evidence를 놓치면 복구 기회가 적다.

**Root Cause:** Turn 감소로 각 질문의 Information Value가 커졌다.

**Fundamental Solution:** Question Evolution의 목표를 conversation length가 아니라 **"Most Important Missing Evidence"** 탐색으로 발전시킨다. 다음 질문은 단순 대화 연장이 아니라 현재 Reality Structure에서 가장 중요한 미확인 Evidence를 찾도록 한다.

### 11.4 Reflection Attribution Drift

**Risk:** 사용자가 말하지 않은 감정·가치·동기·평가가 Reflection에 미세하게 추가될 수 있다.

예: 혼란스러움 / 복잡함 / 소중함 / 특별함 / 솔직한 표현

**Root Cause:** Generative LLM은 자연스러운 문장을 만들면서 설명과 평가를 자동으로 보충하려는 경향이 있다.

**Fundamental Solution:** Reflection을 **Evidence Selection → Discovery Boundary → Language Generation** 세 단계로 명확하게 분리한다. LLM의 역할은 마지막 표현 생성에 집중시키고, 무엇을 말할 수 있는지는 앞 단계의 Evidence Boundary가 결정하도록 발전시킨다. 금지어 목록 확대 방식으로 해결하지 않는다.

### 11.5 LLM Structural Non-Determinism

**Risk:** 동일 입력에서도 Point / Relation / Continuity 결과가 달라질 수 있다.

**Fundamental Solution:** Observation Console에서 Response 품질뿐 아니라 Structural Stability도 측정한다. 향후 지표 후보:

- Reality Point Stability
- Relation Capture Stability
- False Relation Rate
- Reflection Grounding Rate
- Evidence Preservation Rate

동일 또는 유사 Evidence에 대한 구조적 일관성을 Vitality 평가 대상으로 포함한다.

### 11.6 User Evidence / HRI Inference Contamination

**Risk:** 사용자 등록 후 장기 데이터가 쌓이면 HRI의 Observation이나 추론이 사용자의 사실처럼 저장될 수 있다.

**Fundamental Solution:** User-Stated / Inferred / Revised / Superseded 등 provenance/status를 장기 데이터에서도 유지한다. Observation은 Evidence를 덮어쓰지 않는다. HRI가 만든 해석은 사용자가 말한 사실과 동일한 권위를 갖지 않는다.

### 11.7 Aging Observation

**Risk:** 과거의 사용자를 설명했던 Observation이 현재의 사용자에게 계속 적용될 수 있다.

**Fundamental Solution:** Long-term Memory를 단순 누적 DB로 만들지 않는다. 각 정보에 source / provenance / createdAt / lastConfirmedAt / status 등의 생명주기를 갖게 한다. 과거 Reality와 현재 Reality가 다르면 과거 데이터를 삭제하기보다 변화를 보존할 수 있어야 한다.

### 11.8 Cross-Session Reality Conflict

**Risk:** 다른 Session에서 사용자가 이전과 다른 이야기를 할 수 있다.

**Fundamental Solution:** 이를 데이터 오류나 모순으로만 보지 않는다. **"Reality Changed"**라는 가능성을 구조적으로 허용한다. HRI는 사람을 하나의 고정 Profile로 압축하지 않는다.

### 11.9 Question Evolution Over-Optimization

**Risk:** 응답률·대화 지속률이 높은 질문이 좋은 HRI 질문으로 잘못 평가될 수 있다.

**Fundamental Solution:** Question Quality의 중심 지표를 Information Gain / Self-Discovery / Reality Clarification / Grounded Reflection Contribution으로 둔다. Engagement는 보조 지표이지 최상위 목표가 아니다.

### 11.10 Self-Reinforcing Evolution Error

**Risk:** 잘못된 HRI Observation을 근거로 질문이 자동 진화하면 오류가 반복·증폭될 수 있다.

**Fundamental Solution:** Observation → Evaluation → Evolution Proposal → Human Approval → Repository Update 원칙을 유지한다. Runtime이 스스로 Question Repository를 직접 변경하지 않는다.

### 11.11 Multilingual Structural Drift

**Risk:** 동일한 Reality라도 ko/en/ja/zh-CN/zh-HK/zh-TW에서 Point/Relation/Reflection 구조가 달라질 수 있다.

**Fundamental Solution:** Localization QA를 번역 품질 검사로 끝내지 않는다. 동일 의미 입력에 대해 Reality Point / Relation / Grounding / Reflection Boundary가 언어별로 얼마나 일관적인지 Structural Equivalence Test를 장기적으로 구축한다.

### 11.12 User Trust Risk

**Risk:** HRI가 사용자가 말하지 않은 것을 감정·성격·동기·인과로 단정하면 사용자는 "마음의 거울"이 아니라 "나를 판단하는 AI"라고 느낄 수 있다.

이것은 단순 Runtime Bug가 아니라 **HRI 사업 가치 자체를 훼손할 수 있는 최상위 Business Risk다.**

**Fundamental Solution:** HRI의 모든 기술적 최적화보다 Grounded Trust를 우선한다.

원칙: **"더 많이 발견하는 것보다 잘못 발견하지 않는 것이 먼저다."**

---

## 12. Fundamental Architecture Direction

위 문제들은 각각 별개의 Bug처럼 보이지만 근본 원인은 상당 부분 공통적이다.

HRI가 장기적으로 지향할 구조:

```
Human Statement
↓
Evidence Preservation
↓
Reality Point / User-Stated Connection
↓
Uncertainty / Provenance
↓
HRI Interpretation
↓
Grounded Reflection
↓
Observation
↓
Quality Evaluation
↓
Evolution Proposal
↓
Human Approval
↓
Question Evolution
```

핵심 원칙:

1. Evidence는 Interpretation보다 먼저 존재한다.
2. Interpretation은 Evidence를 변경하지 않는다.
3. 불확실성은 실패가 아니라 정상적인 상태다.
4. HRI의 추론은 사용자 발화와 구분한다.
5. Reflection은 Evidence Boundary 밖으로 나가지 않는다.
6. Evolution은 Runtime을 직접 변경하지 않는다.
7. Human Approval이 Evolution의 최종 Gate다.

---

## 13. Development Risk Classification

향후 발견되는 문제는 즉시 모두 수정하지 않는다. 다음 네 단계로 분류한다:

- **A. Release Blocker** — 현재 사용자 경험 또는 데이터 신뢰성을 심각하게 훼손하여 출시 전에 반드시 해결해야 하는 문제.
- **B. Beta Known Limitation** — 안전하게 제한된 상태로 Beta 운영이 가능하며 사용자에게 치명적인 오판을 만들지 않는 문제.
- **C. Post-Beta Improvement** — 실제 사용 Evidence를 축적한 뒤 구조적으로 개선할 문제.
- **D. Research Issue** — 현재 방식의 패치가 아니라 실험과 새로운 구조 검증이 필요한 문제.

현재 User-Stated Relation Detection Stability는 **Beta Known Limitation + Post-Beta Improvement**로 분류한다. False Relation을 강제로 증가시키는 수정은 하지 않는다.

---

> 예측 가능한 문제를 하나씩 뒤쫓아 수정하는 것이
> HRI의 진화는 아니다.
>
> HRI는 문제가 반복해서 발생하는 구조를 발견하고,
> 그 원인을 Evidence와 Interpretation의 분리,
> 불확실성의 보존,
> Observation과 Human Approval을 통해
> 근본적으로 개선한다.
>
> HRI가 성장한다는 것은
> 사용자를 더 많이 추측하게 되는 것이 아니라,
> 사용자가 실제로 보여준 Reality를
> 더 정확하게 보존하고 발견하게 되는 것이다.
