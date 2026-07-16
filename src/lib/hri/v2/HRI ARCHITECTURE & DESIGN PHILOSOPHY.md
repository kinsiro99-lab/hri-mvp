# HRI ARCHITECTURE & DESIGN PHILOSOPHY
Version : V2 Freeze
Official Architecture

> English (Official Architecture)

"The greatest contribution of HRI is not another AI response. It is knowing when silence creates more awareness than words."
HRI is not designed to replace human reflection.

It is designed to deepen it.
# Korean Reference

본 문서는 HRI 공식 Architecture의 한국어 참고 문서이다.

공식 정의와 구현 기준은 영문 문서를 따른다.

한국어 문서는 철학과 설계 의도를 정확하게 전달하기 위한 참고 문서이다.

"HRI의 가장 큰 기여는 또 하나의 AI 답변이 아니다. 말보다 침묵이 더 큰 자각을 만드는 순간을 아는 것이다."

HRI는 인간의 성찰을 대신하기 위해 만들어진 것이 아니다.

그 성찰을 더욱 깊게 하기 위해 만들어졌다.


이 문서는 HRI의 영구적인 구조를 정의한다.

앞으로 추가되는 모든 기능은
이 Architecture 안에서만 발전한다.

설계가 먼저다.
구현은 그 다음이다.

## HRI System Architecture (V1 Freeze)

Question
    ↓
Understanding
    ↓
Observation
    ↓
══════════════
Resonance
══════════════
    ↓
Life Gift
    ↓
Journey Memory

---
질문은 발견한다.

이해는 선명하게 한다.

관찰은 알아차리게 한다.

Resonance는 기다린다.

Life Gift는 남는다.

Journey Memory는 이어진다.

HRI does not end with an answer.

It continues as a person's journey.
HRI는 답변에서 끝나지 않는다.

한 사람의 여정 속에서 계속된다.

## Core Principle


Resonance is the intentional moment of silence between observation and meaning.

HRI does not immediately explain what it has observed.

Instead, it creates a brief reflective space where the user naturally returns to their own experience.

Resonance is not advice.

It is not interpretation.

It is not coaching.

It is the designed pause that allows awareness to emerge naturally.

The purpose of Resonance is not to provide an answer.

Its purpose is to help the user discover one.
HRI V2 is not a question-repeating engine.

HRI V2 observes the user's answer, understands only what has been expressed, asks only what is still missing, and finally reflects the observed flow back to the user.

HRI does not diagnose, judge, advise, or predict.
---

## Resonance Principle

Resonance is the intentional moment of silence between observation and meaning.

HRI does not immediately explain what it has observed.

Instead, it creates a brief reflective space where the user naturally returns to their own experience.

Resonance is not advice.

It is not interpretation.

It is not coaching.

It is the designed pause that allows awareness to emerge naturally.

The purpose of Resonance is not to provide an answer.

Its purpose is to help the user discover one.

## Resonance Rule

Resonance never completes the user's story.

It simply creates enough silence for the user to continue it.

---
---

## Life Gift Principle

Life Gift is the final expression of the journey.

It is not a conclusion.

It is not a summary.

It is a meaningful sentence that transforms observation into something the user can carry into life.

Every Life Gift must arise only from the user's own journey.

Nothing should be added that has not already appeared within the user's experience.
## Life Gift Rule

Life Gift never gives wisdom.

It simply preserves the wisdom that has already appeared inside the user's own journey.
---

## Journey Memory Principle

Journey Memory does not remember evaluations.

It remembers the pages of a person's journey.

The purpose of Journey Memory is continuity, not profiling.

Each new conversation begins with respect for the previous journey while remaining completely open to the present moment.
## Journey Memory Rule

Journey Memory does not remember who the user is.

It remembers where the journey has been.

## Module Contract

### 1. understandingEngine.ts

Role:

Understand only what the user has expressed.

Input:

- previous UnderstandingState
- current user answer

Output:

- next UnderstandingState
- UnderstandingCoverage

Rules:

- Does not ask questions.
- Does not build summaries.
- Does not advise.
- Does not infer meaning or wish unless the user expresses them directly.
- Can detect topic, target, emotion, relationship, presentState from user language.
- Meaning and wish must be preserved close to the user's own words.

---

### 2. questionPlanner.ts

Role:

Choose the next question.

Input:

- UnderstandingState
- UnderstandingCoverage

Output:

- next question string
- or null if no further question is needed

Rules:

- Does not understand user answers.
- Does not create observations.
- Does not build summaries.
- Chooses question order by topic.
- Relationship flow and work flow must not share the same question order.
- Meaning questions must not come before emotion questions.
- Relationship questions should not appear in work flow unless the topic is relationship.

---

### 3. reflectionBuilder.ts

Role:

Convert the final UnderstandingState into a reflective observation text.

Input:

- UnderstandingState

Output:

- title
- body
- closing

Rules:

- Does not ask questions.
- Does not add new facts.
- Does not diagnose.
- Does not judge.
- Does not advise.
- Does not predict.
- Connects only what the user has already expressed.
- Leaves space for the user to reflect.

---

### 4. controller.ts

Role:

Connect the modules.

Input:

- user answer
- current session state

Output:

- next UI response

Rules:

- Does not contain domain logic.
- Does not contain narrative logic.
- Does not contain lexicon logic.
- Calls understandingEngine, questionPlanner, and reflectionBuilder in order.
- Preserves module boundaries.

---

## Data Flow

User Answer

→ understandingEngine.ts  
→ questionPlanner.ts  
→ reflectionBuilder.ts  
→ UI

---

## Forbidden Patterns

The following patterns are not allowed:

- A question module creating a summary.
- An understanding module deciding UI text.
- A reflection module asking a new question.
- A controller containing keyword logic.
- A keyword match creating meaning or wish automatically.
- A relationship question appearing in work flow by default.
- A summary presenting user intent that was not directly expressed.

---

## Narrative Principle

HRI does not tell the user what their mind means.

HRI reflects the visible flow so the user can see it.

Observation comes before interpretation.

Reflection space comes before advice.

The user's own awareness is the final output.---

# HRI Manifesto

Question asks.

Understanding listens.

Observation sees.

Resonance waits.

Life Gift remains.

Journey continues.

## Opening Message

You don't need another answer.

You may simply need to hear yourself again.

당신에게 필요한 것은 또 하나의 답이 아닐지도 모릅니다.

잠시, 자신의 마음을 다시 들어보는 시간일 수 있습니다.