# HRI V2 Architecture

## Core Principle

HRI V2 is not a question-repeating engine.

HRI V2 observes the user's answer, understands only what has been expressed, asks only what is still missing, and finally reflects the observed flow back to the user.

HRI does not diagnose, judge, advise, or predict.

---

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

The user's own awareness is the final output.