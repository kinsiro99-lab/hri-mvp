# HRI V4 · UI Implementation Architecture

Presentation layer only. The engine, controller, questioning logic, and
understanding pipeline are assumed correct and are not touched.

Locked concepts (inputs to this design):
- Two layers: **Evidence** (Message History — immutable, verbatim, source of
  truth) and **Interpretation** (Observation — grows on top of Evidence).
- Observation is one living object with **three dimensions** — Present,
  Rhythm, Emerging Meaning — and one **maturity axis**, Awareness State.
- Awareness is not a region. It is the clarity of the whole object, and it
  equals the engine's `confidence`. Never shown as a number, score, or label.
- Guide and Final Advice are derived outputs, generated only after the
  Observation matures. They live outside the Observation.

---

## 1. Component Architecture

Component tree. Indentation is parent → child. `[A]` marks the one component
allowed to touch the engine (the Adapter). Every other component is
engine-blind and receives only View props.

```
HriSessionV4  [A] Adapter — the only engine-aware file
│   owns engine calls + state, converts engine → View model, owns no layout
│
└── ObservationExperience            root view; owns scene + layout, no engine
    │
    ├── Stage                        AURINA presence + identity + maturity read-out
    │   ├── AurinaPresence           orb / halo / reflection / waterline
    │   │   └── (avatar slot)        future video / canvas — unchanged signature
    │   ├── Wordmark                 AURINA + tagline (scales by scene)
    │   └── StageVoice               AURINA's current line (MC)
    │
    ├── ObservationWorkspace         the living object — CENTER, primary surface
    │   ├── FlowSummary              live caption of the whole object (from turn 1)
    │   ├── PresentRegion            dimension 1
    │   ├── RhythmRegion             dimension 2
    │   ├── EmergingMeaningRegion    dimension 3
    │   └── (maturity is not a child — it is a prop threaded into all four above)
    │
    ├── EvidencePanel                Message History — verbatim, immutable, recessive
    │   ├── CurrentExchange          the one open question + last capture (always shown)
    │   └── EvidenceTrace            full transcript (collapsible; the "source of truth")
    │
    ├── DerivedOutputs               appears only after Observation matures
    │   ├── GuidePanel               operational guidance (unlocks at threshold)
    │   └── FinalAdvicePanel         terminal derived output (session end)
    │
    └── Compose                      Observation Capture — fixed, mobile-first
        └── (current open question renders just above, as quiet prompt)
```

Notes that carry meaning:

- **AwarenessState has no component.** It is a single value (derived from
  engine `confidence`) passed as a prop into `Stage`, `ObservationWorkspace`,
  and each Region. Those components express it through clarity (focus,
  connection, settledness) — never render it as content. Making it a component
  would turn it into a score.
- **EvidencePanel is not the Workspace.** Evidence is verbatim and immutable;
  the Workspace re-resolves. They must be separate components so their update
  rules can differ: EvidencePanel is append-only, Workspace is
  transform-in-place.
- **DerivedOutputs is gated**, not always mounted. It does not exist in the
  tree (or renders null) until maturity crosses the threshold. This is what
  makes "Guide unlocks" structural rather than cosmetic.
- **GuidePanel stays Data-Driven** (existing `guideItems[]` contract) for its
  static operational content; when the engine later emits session-specific
  guidance, that arrives as a separate prop without changing the component's
  shape.

---

## 2. Data Flow

### 2a. The engine path is unchanged

```
/api/analyze
   → getNextOutput
      → runHriSession (sessionAdapter.ts)   replays all inputs each request
         → advanceSession (controller.ts)    HRI_V2 block only
            → updateUnderstanding             → UnderstandingState (7 slots)
            → planObservation                 → ObservationResult (+ hypothesis)
            → selectQuestion / reflection     → question | reflection
```

Everything above the line below already exists and does not change. The
Adapter reads its outputs; it never reaches inside.

### 2b. Engine output → View model → component

```
ENGINE OUTPUT              ADAPTER MAPS TO (View model)       CONSUMED BY
─────────────────────────────────────────────────────────────────────────
history[] (userText,       evidence.entries[]                EvidencePanel
  hriResponse)             currentExchange                   CurrentExchange
  = Message History        (last question + last capture)    Compose (prompt)

understanding.presentState observation.present               PresentRegion

buildHypothesis()          observation.rhythm                RhythmRegion
  .observations[]           (relations between slots)
  .summary

understanding.meaning      observation.emergingMeaning       EmergingMeaningRegion

confidence                 observation.maturity              Stage,
  (hypothesis explanatory   (a single opaque value —          ObservationWorkspace,
   power)                    NOT rendered as number)          all Regions, FlowSummary

reflection                 observation.summary               FlowSummary
                            (live caption, evolves each turn)

phase                      aurinaState                       Stage / StageVoice
                            (standby/observing/                Compose (disabled)
                             resonating/reflecting)

guide       (future)       derived.guide                     GuidePanel
final advice (future)      derived.finalAdvice               FinalAdvicePanel
```

### 2c. The one-directional rule

```
        Evidence (verbatim, immutable)
             │  derives ▼   never writes back ▲
        Understanding (slots)
             │  derives ▼
        Observation (dimensions + maturity)
             │  derives ▼   (only when mature)
        Guide → Final Advice
```

Data only flows down. No higher layer mutates a lower one. The Adapter is the
only place the engine's shapes become View shapes; if the engine changes, only
section 2b's middle column changes.

### 2d. Present-day honesty

Today the engine emits `reflection` reliably and the richer Observation
fields partially. The Adapter fills what exists and leaves the rest empty.
Empty dimensions render as "not yet clear," never as fabricated content. This
is the same discipline already shipped in V3's ObservationPanel.

---

## 3. State Transition

The session is driven by **Evidence accumulating**. Every other transition is
a consequence, not an independent event. No percentages — only thresholds
that are already computed by the engine (`hasEnoughDetail`, slot coherence,
`CONFIDENCE_ENOUGH`).

```
                    ┌─────────────────────────────────────────┐
                    │  STANDBY                                  │
                    │  Evidence empty · Observation dormant     │
                    └───────────────────┬─────────────────────┘
                        user captures    │  (first Evidence)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │  PRESENT APPEARS                          │
                    │  presentState slot fills →                │
                    │  PresentRegion resolves from faint        │
                    └───────────────────┬─────────────────────┘
                        ≥2 slots cohere  │  (buildHypothesis returns relations)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │  RHYTHM EMERGES                           │
                    │  relation between dimensions appears →    │
                    │  RhythmRegion connects Present to more    │
                    └───────────────────┬─────────────────────┘
                        meaning earned   │  (meaning slot fills — latest, may not)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │  EMERGING MEANING BECOMES AVAILABLE       │
                    │  EmergingMeaningRegion resolves           │
                    │  (may stay faint if never earned)         │
                    └───────────────────┬─────────────────────┘
                        confidence rises │  (whole object coheres)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │  OBSERVATION MATURES  (Awareness State)   │
                    │  focus sharpens · dimensions connect ·    │
                    │  language settles · motion stills         │
                    │  — the user feels clarity; nothing labels │
                    └───────────────────┬─────────────────────┘
                        crosses threshold│  (CONFIDENCE_ENOUGH / shouldObserve stop)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │  GUIDE UNLOCKS                            │
                    │  DerivedOutputs mounts · GuidePanel shows │
                    └───────────────────┬─────────────────────┘
                        session closes   │
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │  FINAL ADVICE                             │
                    │  FinalAdvicePanel — terminal derived out  │
                    └─────────────────────────────────────────┘
```

Properties this diagram must preserve:
- **Monotonic.** Dimensions only gain clarity; the object never regresses or
  contradicts itself. A refined read replaces its predecessor in place.
- **Maturity is emergent, not a step.** "Observation Matures" is not a stage
  the code sets; it is the rising `confidence` read through clarity cues. The
  three content stages above it can each be partial; maturity is how well they
  cohere, computed continuously.
- **Guide/Final Advice are gated by the same threshold** that already stops
  questioning (`shouldObserve` / `CONFIDENCE_ENOUGH`). One value governs
  stop-asking, unlock-guide, and felt-clarity — no new engine logic.
- **The path can stall honestly.** If meaning never fills, Emerging Meaning
  stays faint and maturity caps below threshold — Guide simply doesn't unlock.
  That is correct behavior, not a bug to paper over.

---

## 4. UI Layout Blueprint

Wireframe only. No color, no type, no visual treatment — spatial relationships
and stacking order.

### Desktop

The Observation is the center of gravity. Evidence recedes to a supporting
rail. Guide/Final Advice occupy space only after maturity.

```
┌──────────────────────────────────────────────────────────────────────┐
│                              STAGE                                     │
│              AURINA presence · identity · voice                        │
│         (compact once session begins; maturity read-out)               │
├───────────────┬──────────────────────────────────────┬───────────────┤
│               │                                        │               │
│  EVIDENCE     │      OBSERVATION WORKSPACE             │  DERIVED      │
│  (recessive)  │      = the living object               │  (gated)      │
│               │                                        │               │
│  Current      │   ┌────────── Flow Summary ─────────┐  │  empty until  │
│  Exchange     │   │  live caption of the whole      │  │  maturity;    │
│  (always)     │   └─────────────────────────────────┘  │  then:        │
│               │                                        │               │
│  ┌─────────┐  │   ┌ Present ─────────────────────┐    │  Guide        │
│  │Evidence │  │   │  (faint → clear)              │    │               │
│  │Trace    │  │   └──────────────────────────────┘    │  Final        │
│  │(collaps)│  │   ┌ Rhythm ──────────────────────┐    │  Advice       │
│  │ source  │  │   │  (connects the dimensions)    │    │               │
│  │ of truth│  │   └──────────────────────────────┘    │               │
│  └─────────┘  │   ┌ Emerging Meaning ────────────┐    │               │
│               │   │  (latest; may stay faint)     │    │               │
│               │   └──────────────────────────────┘    │               │
│               │                                        │               │
├───────────────┴──────────────────────────────────────┴───────────────┤
│                          COMPOSE (fixed)                               │
│         current open question (quiet)  +  capture field                │
└──────────────────────────────────────────────────────────────────────┘
```

Left rail is deliberately narrow and quiet — present as foundation, never
competing with center. Right column has zero width/weight until Guide unlocks,
so pre-maturity the layout reads as two zones (Evidence | Observation), and
post-maturity as three.

### Mobile

One column. The scroll surface **is** the Observation — the user scrolls
through their own observation, not a chat log. Evidence and Derived outputs
become reachable sheets, not always-open panels.

```
┌───────────────────────────┐
│   STAGE (compact, fixed)   │   AURINA presence + maturity
├───────────────────────────┤
│                            │
│   OBSERVATION WORKSPACE     │   ← the scrollable object
│   ┌ Flow Summary ────────┐ │
│   │ live caption          │ │
│   └───────────────────────┘ │
│   ┌ Present ─────────────┐ │
│   └───────────────────────┘ │
│   ┌ Rhythm ──────────────┐ │
│   └───────────────────────┘ │
│   ┌ Emerging Meaning ────┐ │
│   └───────────────────────┘ │
│                            │
│   ·· Evidence (sheet) ··   │   ← handle; opens verbatim trace
│   ·· Guide (after mature)· │   ← appears in-flow once unlocked
│                            │
├───────────────────────────┤
│  current question (quiet)  │
│  COMPOSE (fixed bottom)    │   ← no layout shift; --kb correction
└───────────────────────────┘
```

Mobile rule: Compose never moves; only the Observation scrolls. Evidence is
one tap away (sheet), honoring "accessible but not dominant." Keyboard, IME,
safe-area handling are the already-verified mechanisms — unchanged.

---

## 5. Component Responsibilities

Format per component: Purpose · Input · Output · Engine dependency ·
Rendering responsibility.

### HriSessionV4 (Adapter)
- **Purpose** the only engine-aware component; owns session state and the
  engine→View conversion.
- **Input** user actions (send, restart); engine results from `callEngine`.
- **Output** a complete View model (evidence, observation, derived,
  aurinaState) passed down; callbacks up.
- **Engine dependency** DIRECT and exclusive. Imports `callEngine`. Holds
  `phase / history / allInputs / reflection` etc. — identical to today's
  session file.
- **Rendering** none. Renders only `<ObservationExperience>`. No layout, no
  CSS class.

### ObservationExperience (root view)
- **Purpose** own scene state and overall layout composition.
- **Input** the View model + callbacks from the Adapter.
- **Output** callbacks upward only.
- **Engine dependency** NONE.
- **Rendering** the grid/stack, scene data-attribute, scroll container,
  keyboard viewport hook. Places Stage / Evidence / Workspace / Derived /
  Compose.

### Stage
- **Purpose** AURINA's permanent presence and identity; a second read-out of
  maturity.
- **Input** `aurinaState`, `maturity`, optional `voice`, optional `avatar`,
  optional `actions`.
- **Output** none (interaction elements come in via `actions`, parent owns
  handlers).
- **Engine dependency** NONE. `maturity` is opaque; Stage expresses it as
  presence (breathing, palette drift) — never prints it.
- **Rendering** presence orb, wordmark (scale by scene), voice line.

### EvidencePanel
- **Purpose** the source of truth — verbatim Message History, recessive.
- **Input** `evidence.entries[]` (immutable), `currentExchange`.
- **Output** none.
- **Engine dependency** NONE (consumes mapped history).
- **Rendering** CurrentExchange always; EvidenceTrace collapsible. Append-only;
  never rewrites an entry.

### ObservationWorkspace
- **Purpose** the living Observation object; primary surface.
- **Input** `observation { present, rhythm, emergingMeaning, summary }`,
  `maturity`.
- **Output** none.
- **Engine dependency** NONE.
- **Rendering** composes FlowSummary + three Regions; threads `maturity` into
  each; owns the "one object" framing (connective treatment between regions).

### FlowSummary
- **Purpose** live plain-language caption of the whole object; present from
  turn 1, evolves each turn.
- **Input** `observation.summary`, `maturity`.
- **Output** none.
- **Engine dependency** NONE (maps `reflection`).
- **Rendering** one short evolving passage; register settles as maturity rises.
  Re-resolves in place (crossfade), never appends versions.

### PresentRegion / RhythmRegion / EmergingMeaningRegion
- **Purpose** the three dimensions of the object.
- **Input** its own slice (`present` | `rhythm` | `emergingMeaning`) +
  `maturity`.
- **Output** none.
- **Engine dependency** NONE. Present←`presentState`; Rhythm←`buildHypothesis`
  relations; Emerging Meaning←`meaning`.
- **Rendering** renders content only when its slice exists; otherwise a neutral
  "not yet clear" state. Clarity (focus/contrast) driven by `maturity`.
  Transforms in place on refinement — no diff log.

### GuidePanel
- **Purpose** operational guidance; unlocks at maturity.
- **Input** `guideItems[]` (static, Data-Driven) and later `derived.guide`.
- **Output** none.
- **Engine dependency** NONE now; consumes `derived.guide` when the engine
  emits it.
- **Rendering** renders nothing until mounted by the maturity gate.

### FinalAdvicePanel
- **Purpose** terminal derived output at session end.
- **Input** `derived.finalAdvice`.
- **Output** none.
- **Engine dependency** NONE (consumes mapped value).
- **Rendering** null until present; then a single settled block.

### Compose
- **Purpose** Observation Capture — fixed, mobile-first.
- **Input** `value`, `disabled`, `openQuestion` (quiet prompt), `placeholder`.
- **Output** `onChange`, `onSend` upward.
- **Engine dependency** NONE. Controlled; parent owns `inputValue` +
  `handleSubmit` unchanged.
- **Rendering** fixed bar; renders current open question above the field;
  IME/keyboard/safe-area verified mechanisms.

---

## 6. Integration Plan

The rule: **the presentation layer is additive.** Nothing in
`controller / sessionAdapter / understandingEngine / questionPlanner /
selector` is edited. The seam is a single Adapter, exactly as V3 established.

```
      EXISTING (unchanged)                 NEW (additive)
   ┌────────────────────────┐          ┌──────────────────────────┐
   │ /api/analyze           │          │ components/hri/v4/*       │
   │ controller.ts          │          │  ObservationExperience    │
   │ sessionAdapter.ts      │          │  Stage / Evidence /       │
   │ understandingEngine.ts │◄────────▶│  Workspace / Regions /    │
   │ questionPlanner.ts     │  callEngine  Guide / Compose         │
   │ selector.ts            │  (read only) │                       │
   │ observationEngine.ts   │          │ HriSession.v4-adapter.tsx │
   └────────────────────────┘          └──────────────────────────┘
                                          the only engine-aware file
```

Integration invariants:
1. **One import boundary.** Only `HriSession.v4-adapter.tsx` imports
   `@/lib/api`. A grep gate (as in V3) proves no `v4/*` component references
   the engine.
2. **No engine field is required to exist.** The Adapter maps what's present;
   absent fields → empty View slots → "not yet clear." So the UI ships before
   the Observation Engine is fully wired.
3. **CSS scoped** under a single root class (as `.hri-v3` did), with in-scope
   normalization; existing `globals.css` untouched.
4. **The old session file is not overwritten** — the V4 adapter ships beside
   it; `page.tsx` switches the import when ready, and can switch back.
5. **Mobile stability mechanisms are carried over verbatim** (visualViewport
   `--kb`, IME composition guards, dvh fallback, safe-area).

Where the engine is not yet rich enough, the mapping degrades gracefully:
`present` from `presentState`, `rhythm` from `buildHypothesis` if wired else
empty, `emergingMeaning` from `meaning` if filled else faint, `maturity` from
`confidence` if exposed else derived coarsely from slot coverage. None of this
requires engine edits — only what the Adapter chooses to read.

---

## 7. Migration Roadmap

Low-risk, incremental. Each step is independently shippable and reversible.
The app stays functional after every step.

**Step 1 — Scaffold the seam, no visible change.**
Add `components/hri/v4/` and `HriSession.v4-adapter.tsx` that wraps the current
engine calls and renders the *existing* V3 view. Prove the adapter boundary
(grep gate green). Nothing changes for the user. Reversible by import switch.

**Step 2 — Build the View model + types.**
Define the View model (evidence / observation / derived / aurinaState) and the
Adapter mapping from engine outputs. Unit-map against real `callEngine`
results. Still rendering V3. This is the contract everything else consumes.

**Step 3 — ObservationWorkspace with FlowSummary only.**
Introduce the center object rendering just the live caption (from
`reflection`). Replace V3's center with it behind a flag. One region of risk,
easy to compare.

**Step 4 — Add the three Regions, empty-tolerant.**
Present, Rhythm, Emerging Meaning — each rendering only when its slice exists,
neutral otherwise. Wire `maturity` as an opaque prop; express as clarity.
No engine change; regions light up as far as today's outputs allow.

**Step 5 — EvidencePanel (recessive).**
Move Message History into the Evidence layer: CurrentExchange always visible,
EvidenceTrace collapsible. This is where the "two-layer" architecture becomes
real on screen. Verify verbatim + immutable.

**Step 6 — Stage as maturity read-out.**
Bring in AURINA presence and bind it to `aurinaState` + `maturity`
(breathing, palette drift). Scene transitions (opening → observation →
resonance → insight) as lighting changes on the same stage.

**Step 7 — Maturity gate + DerivedOutputs.**
Mount GuidePanel / FinalAdvicePanel only past the threshold
(`CONFIDENCE_ENOUGH`). Guide "unlocks" structurally. Keep GuidePanel's static
Data-Driven content; wire `derived.*` when the engine emits it.

**Step 8 — Mobile pass.**
Collapse to one column; Observation becomes the scroll surface; Evidence and
Guide become sheets. Re-verify keyboard/IME/safe-area. Compose fixed, no shift.

**Step 9 — Clarity-cue polish.**
Tune the maturity expression: focus/contrast ramp, inter-region connection,
language settling, stillness, negative space. This is the last 20% that makes
"becoming clear" felt. Monotonic + unlabeled guardrail enforced.

**Step 10 — Switch default + retire V3 view.**
Flip `page.tsx` import to the V4 adapter. Keep V3 one import away for one
release. Remove after confidence.

Risk profile: steps 1–2 are zero-visible-risk plumbing; 3–5 are the
structural core (behind a flag, comparable to V3); 6–9 are additive polish;
10 is a one-line switch with a fallback. No step edits the engine.

---

## Non-negotiables (carried from locked concepts)

- Engine, controller, questioning logic, understanding pipeline: **unchanged.**
- Evidence: verbatim, immutable, append-only, always accessible, never dominant.
- Observation: one object, three dimensions, transforms in place, never a card stack.
- Awareness = maturity = `confidence`, expressed as clarity, **never** a
  number/score/label.
- Guide / Final Advice: derived, gated by maturity, outside the Observation.
- Only the presentation layer changes.
