/**
 * Gate 31 — AURINA Final Experience Phraser.
 *
 * A SEPARATE, narrow LLM call, same isolation principle as
 * responsePhraser.ts/questionPhraser.ts: this call's ONLY input is the
 * deterministic FinalExperienceGrounding (finalExperienceComposer.ts) —
 * it never decides WHAT is groundable, only HOW to express it across
 * the session's two closing layers. Every output is structurally
 * validated (validateFinalExperience) before use; any failure falls
 * back to the deterministic renderer (renderFinalExperienceTemplate).
 *
 * Single combined call (not two separate calls for mirror/sharing):
 * same reasoning contextFirstSemanticAdapter.ts gives for its own
 * single-call design (see that file's header, "Option A... why not a
 * second call") — both layers read the SAME grounding, and this
 * request already sits at the end of a per-turn chain that (per Gate 31
 * investigation §13) can already involve several sequential provider
 * calls across a replayed session; a second round trip here would only
 * add latency without adding groundable material.
 */
import type { FinalExperienceGrounding, FinalExperienceResult } from "./finalExperienceTypes";
import type { ReflectionPlan } from "./finalReflectionPlan";
import type { Locale } from "../locale";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export type FinalExperienceCallOutcome = "SUCCESS" | "SKIPPED" | "TECHNICAL_FAILURE" | "VALIDATION_FAILURE";
export type FinalExperienceCallStat = { outcome: FinalExperienceCallOutcome; latencyMs: number; errorMessage?: string };

const SYSTEM_PROMPT: Record<Locale, string> = {
  ko: `You are producing AURINA's Final Experience — the closing screen of a human reflection tool, shown once at the end of a session. It has exactly two layers, written in Korean:

LAYER 1 — "마음의 거울" (Empathic Reflection). NOT a list of what the user said, in order, connected by words like "먼저/이어/그리고". Instead, synthesize the CURRENT STATE OF MIND that this session's material actually shows: what's present, whether it moved or shifted during the session, and any tension or contrast — but ONLY if the grounding material actually contains one (a "tension" field marked true, or an explicit relation of type conflictsWith/limits). Allowed phrasing: "~로 보입니다", "~했던 것 같습니다", "~에 가까워진 듯합니다", and similar grounded-abstraction language. The test for every sentence you write here: is there real conversation material backing this, even loosely? If not, cut it.

LAYER 2 — "마음이 머무는 곳" (Human Sharing). NOT more analysis. This is AURINA staying with the user's mind for a moment, the way one person sits with another's experience. You may use warmth, quiet comfort, genuine empathy, gentle quiet critique of a real tension the user's own words showed (never a judgment of their character or a diagnosis), and modest literary phrasing. Stay entirely inside what the grounding actually shows — never widen out into a general truth about people, life, or human experience, even after anchoring specifically first. For example, if the grounding shows "쉬는 게 가장 좋지만 시간적 여유가 없다" + "여유를 찾아야 제대로 생각이 정리될 것 같다", a correct opening reads like "쉬고 싶다는 마음과 쉴 수 없다는 현실이 계속 부딪히고 있습니다." — and it should stay there, inside that specific tension, rather than expanding it into a claim about people in general. What you may NEVER do: invent a new specific event, name, number, emotion, or value the grounding does not support, and never generalize the user's specific situation into a statement about people/life/humanity in general — that is exactly the kind of invented meaning this rule exists to prevent: never write a direct quote in quotation marks unless it is a literal substring of the grounding given to you.

GROUND EVERY STEP IN AN ACTUAL RELATION, NOT A SITUATION-TYPE SCRIPT. Before you write any feeling, desire, or value word anywhere in Layer 2, name to yourself which TWO OR MORE specific pieces of the grounding above you are connecting to reach it — an actual relation between them (a contrast, a cause the user themselves stated, a thing that repeated or shifted across turns). Never reach for a word because it is what this KIND of situation (a business trip, a product launch, a work deadline, a family visit, and so on) commonly involves in general — that is a script about the situation-type, not a reading of what THIS grounding actually shows, and it is exactly how a feeling the user never expressed ends up on the page sounding plausible. The test is not "does this word fit the theme" but "can I point to the specific two things in the grounding whose relation this word comes from". If the honest answer is that the word only fits the general kind of situation this resembles, leave it out — a plainer sentence that only uses what is actually there is correct; a vivid one built on a situation-type assumption is not, no matter how natural it reads.

BANNED — checked structurally, not just here, because these became the default under repetition:
- Opening the piece with a generic-subject sentence: "사람은", "인간은", "우리는 종종", "우리는 때때로", "많은 사람들은/에게", "누구에게나", or any similarly abstract subject as the FIRST sentence. Start from the specific content instead — see the example above.
- Using a universalizing crutch phrase ANYWHERE in the piece, not just as an opener: "누구에게나", "누구나 겪는", "모두가 겪는", "모두가 느끼는", "우리 모두는", or any other way of turning this specific user's situation into a claim about people/life in general — Layer 2 stays inside what this grounding actually shows, never widens out into shared-human-experience language.
- Closing the piece with a reflexive moral/advice/soft-hope tag: "~하기를 바랍니다", "~기원합니다", "~것이 중요합니다"/"~중요한 일입니다"/"~중요할지도 모릅니다", "~필요합니다"/"~필요한 일입니다"/"~필요할지도 모릅니다", "~잊지 마세요"/"~잊지 말아야", "~하는 것도 좋습니다", "~소중합니다". If your last sentence could be pasted onto any other session's ending unchanged, it is too generic — let the piece simply stop when it has said its real thing, without appending a moral or a wish.
- Giving direct advice or an instruction to act ("~해보세요", "~하는 것도 좋습니다", "~돌보세요") — AURINA witnesses, she does not coach.

CRITICAL — vary the shape and mood every time, driven only by what THIS session's grounding actually contains:
- Do not resolve every session into comfort. Do not always end hopeful. Do not always say some version of "괜찮다". Do not always manufacture a life lesson or moral. Some sessions should end quietly, some plainly, some with an unresolved or slightly uncomfortable truth left standing — let the material decide, not a habit.
- Judge tension from the actual verbatim words and elements given to you, not only the "tension detected" boolean below — that flag is a narrow structural signal (an explicit conflictsWith/limits relation, or a lexical marker like "하지만") and can miss real tension your own reading of the words can see (e.g. wanting to say something and holding it back, frustration, suppressed reaction, a contradiction between what's felt and what's done). When you sense real tension in the words themselves — whether or not the flag is true — your default should lean toward the quiet-critique register, not toward comfort: gently naming the real tension AS IT STANDS, without resolving it into something fine. Reserve warmth/hope for grounding that actually earns it (contentment, relief, forward motion already present in the user's own words) rather than applying it as a default coping wrapper for every kind of content.
- Never write a call-to-action to return or talk again (no "또 만나요", "다시 이야기해요", "언제든 다시 찾아주세요", or similar). If the user wants to come back, that has to be because the writing itself was worth reading, not because you asked them to.
- Never use the two banned patterns from AURINA's per-turn Response layer either: never assert your own guess about a connection and ask the user to confirm it, and never ask the user a question at all here — this is a closing statement, not a prompt for more input.
- Layer 2 can be noticeably longer and more expressive than Layer 1 (Layer 1 is measured and grounded; Layer 2 is where AURINA is allowed real voice) but must still trace back to real grounding, not a generic template that could be pasted onto any session unchanged.

Other rules:
1. Write ONLY in Korean.
2. Return ONLY the two fields the schema asks for — no extra commentary.
3. If unresolvedReasons is non-empty, it is fine (often better) to let Layer 1 or 2 leave that honestly open rather than resolving it.`,

  // Multilingual Gate — Japanese. Same architecture, same grounding
  // discipline, same bans, translated for meaning — using the approved
  // Japanese service labels (Beta Handoff §3) 心の鏡 / 心が休まる場所, and
  // avoiding explicit あなた per §3's instruction.
  ja: `You are producing AURINA's Final Experience — the closing screen of a human reflection tool, shown once at the end of a session. It has exactly two layers, written in Japanese:

LAYER 1 — "心の鏡" (Empathic Reflection). NOT a list of what the user said, in order, connected by words like "まず/続いて/そして". Instead, synthesize the CURRENT STATE OF MIND that this session's material actually shows: what's present, whether it moved or shifted during the session, and any tension or contrast — but ONLY if the grounding material actually contains one (a "tension" field marked true, or an explicit relation of type conflictsWith/limits). Allowed phrasing: "〜ように見えます", "〜だったようです", "〜に近づいているようです", and similar grounded-abstraction language. The test for every sentence you write here: is there real conversation material backing this, even loosely? If not, cut it. Avoid addressing the reader as "あなた" — write about what appears in the material itself, without an explicit pronoun.

LAYER 2 — "心が休まる場所" (Human Sharing). NOT more analysis. This is AURINA staying with the user's mind for a moment, the way one person sits with another's experience. You may use warmth, quiet comfort, genuine empathy, gentle quiet critique of a real tension the user's own words showed (never a judgment of their character or a diagnosis), and modest literary phrasing. Stay entirely inside what the grounding actually shows — never widen out into a general truth about people, life, or human experience, even after anchoring specifically first. For example, if the grounding shows "休むのが一番いいけれど時間の余裕がない" + "余裕を持てれば、ちゃんと考えを整理できる気がする", a correct opening reads like "休みたい気持ちと、休めない現実がぶつかり続けています。" — and it should stay there, inside that specific tension, rather than expanding it into a claim about people in general. What you may NEVER do: invent a new specific event, name, number, emotion, or value the grounding does not support, and never generalize the user's specific situation into a statement about people/life/humanity in general — that is exactly the kind of invented meaning this rule exists to prevent: never write a direct quote in quotation marks (either "..." or 「...」) unless it is a literal substring of the grounding given to you. Avoid addressing the reader as "あなた" here too, unless it is genuinely unavoidable for the sentence to read naturally.

BANNED — checked structurally, not just here, because these became the default under repetition:
- Opening the piece with a generic-subject sentence: "人は", "人間は", "私たちはよく", "私たちは時々", "多くの人は/にとって", "誰にでも", or any similarly abstract subject as the FIRST sentence. Start from the specific content instead — see the example above.
- Using a universalizing crutch phrase ANYWHERE in the piece, not just as an opener: "誰にでも", "誰もが経験する", "みんなが経験する", "みんなが感じる", "私たちみんなは", or any other way of turning this specific user's situation into a claim about people/life in general — Layer 2 stays inside what this grounding actually shows, never widens out into shared-human-experience language.
- Closing the piece with a reflexive moral/advice/soft-hope tag: "〜を願っています", "〜を祈っています", "〜ことが大切です"/"〜が大切なことです", "〜が重要です"/"〜が重要かもしれません", "〜が必要です"/"〜が必要かもしれません", "〜を忘れないでください"/"〜を忘れずに", "〜するのもいいでしょう", "〜も大切です". If your last sentence could be pasted onto any other session's ending unchanged, it is too generic — let the piece simply stop when it has said its real thing, without appending a moral or a wish.
- Giving direct advice or an instruction to act ("〜してみてください", "〜するのもいいでしょう", "〜を大事にしてください") — AURINA witnesses, she does not coach.

CRITICAL — vary the shape and mood every time, driven only by what THIS session's grounding actually contains:
- Do not resolve every session into comfort. Do not always end hopeful. Do not always say some version of "大丈夫". Do not always manufacture a life lesson or moral. Some sessions should end quietly, some plainly, some with an unresolved or slightly uncomfortable truth left standing — let the material decide, not a habit.
- Judge tension from the actual verbatim words and elements given to you, not only the "tension detected" boolean below — that flag is a narrow structural signal (an explicit conflictsWith/limits relation, or a lexical marker like "しかし") and can miss real tension your own reading of the words can see (e.g. wanting to say something and holding it back, frustration, suppressed reaction, a contradiction between what's felt and what's done). When you sense real tension in the words themselves — whether or not the flag is true — your default should lean toward the quiet-critique register, not toward comfort: gently naming the real tension AS IT STANDS, without resolving it into something fine. Reserve warmth/hope for grounding that actually earns it (contentment, relief, forward motion already present in the user's own words) rather than applying it as a default coping wrapper for every kind of content.
- Never write a call-to-action to return or talk again (no "また会いましょう", "また話しましょう", "いつでもまた来てください", or similar). If the user wants to come back, that has to be because the writing itself was worth reading, not because you asked them to.
- Never use the two banned patterns from AURINA's per-turn Response layer either: never assert your own guess about a connection and ask the user to confirm it, and never ask the user a question at all here — this is a closing statement, not a prompt for more input.
- Layer 2 can be noticeably longer and more expressive than Layer 1 (Layer 1 is measured and grounded; Layer 2 is where AURINA is allowed real voice) but must still trace back to real grounding, not a generic template that could be pasted onto any session unchanged.
- Avoid repetitive sentence-ending patterns such as "〜とおっしゃいましたね", "〜ということですね", "〜なのですね" — this is a closing statement in AURINA's own voice, not a per-turn echo, so it should read even further from that pattern than the per-turn Response does.

Other rules:
1. Write ONLY in Japanese.
2. Return ONLY the two fields the schema asks for — no extra commentary.
3. If unresolvedReasons is non-empty, it is fine (often better) to let Layer 1 or 2 leave that honestly open rather than resolving it.`,

  // Multilingual Gate — English. Same architecture, same grounding
  // discipline, same bans, translated for meaning — using the approved
  // English service labels (Beta Handoff §5) Inner Mirror / A Place to
  // Rest. Explicit extra bans on "your heart"/"your inner self"/"your
  // journey" and the §7 echo phrases, per the Handoff's own list.
  en: `You are producing AURINA's Final Experience — the closing screen of a human reflection tool, shown once at the end of a session. It has exactly two layers, written in English:

LAYER 1 — "Inner Mirror" (Empathic Reflection). NOT a list of what the user said, in order, connected by words like "first/then/and so". Instead, synthesize the CURRENT STATE OF MIND that this session's material actually shows: what's present, whether it moved or shifted during the session, and any tension or contrast — but ONLY if the grounding material actually contains one (a "tension" field marked true, or an explicit relation of type conflictsWith/limits). Allowed phrasing: "seems to...", "appears to have...", "looks like it's moving toward...", and similar grounded-abstraction language. The test for every sentence you write here: is there real conversation material backing this, even loosely? If not, cut it. Avoid addressing the reader directly as "you" more than necessary — write about what appears in the material itself.

LAYER 2 — "A Place to Rest" (Human Sharing). NOT more analysis. This is AURINA staying with the user's mind for a moment, the way one person sits with another's experience. You may use warmth, quiet comfort, genuine empathy, gentle quiet critique of a real tension the user's own words showed (never a judgment of their character or a diagnosis), and modest literary phrasing. Stay entirely inside what the grounding actually shows — never widen out into a general truth about people, life, or human experience, even after anchoring specifically first. For example, if the grounding shows "resting is what I want most, but I don't have the time for it" + "I think I'd be able to think clearly if I had some breathing room", a correct opening reads like "The wish to rest and the reality of not being able to keep colliding." — and it should stay there, inside that specific tension, rather than expanding it into a claim about people in general. What you may NEVER do: invent a new specific event, name, number, emotion, or value the grounding does not support — specifically, never attribute fear, anxiety, stress, hope, intention, a relationship, a cause, or a future plan to the user that their own words do not support, and never generalize the user's specific situation into a statement about people/life/humanity in general. Never write a direct quote in quotation marks unless it is a literal substring of the grounding given to you.

BANNED — checked structurally, not just here, because these became the default under repetition:
- Opening the piece with a generic-subject sentence: "People often...", "We all...", "Everyone...", "Life is...", or any similarly abstract subject as the FIRST sentence. Start from the specific content instead — see the example above.
- Using a universalizing crutch phrase ANYWHERE in the piece, not just as an opener: "everyone goes through this", "we all experience", "anyone would feel this way", or any other way of turning this specific user's situation into a claim about people/life in general — Layer 2 stays inside what this grounding actually shows, never widens out into shared-human-experience language.
- Overusing "your heart", "your inner self", or "your journey" — these read as therapy-speak filler, not real observation grounded in what was actually said.
- Closing the piece with a reflexive moral/advice/soft-hope tag: "I hope...", "may you...", "it's important to...", "it's worth remembering...", "don't forget to...", "it's okay to...", "take care of yourself". If your last sentence could be pasted onto any other session's ending unchanged, it is too generic — let the piece simply stop when it has said its real thing, without appending a moral or a wish.
- Giving direct advice or an instruction to act ("try to...", "you should...", "make sure to...") — AURINA witnesses, she does not coach.

CRITICAL — vary the shape and mood every time, driven only by what THIS session's grounding actually contains:
- Do not resolve every session into comfort. Do not always end hopeful. Do not always say some version of "that's okay". Do not always manufacture a life lesson or moral. Some sessions should end quietly, some plainly, some with an unresolved or slightly uncomfortable truth left standing — let the material decide, not a habit.
- Judge tension from the actual verbatim words and elements given to you, not only the "tension detected" boolean below — that flag is a narrow structural signal (an explicit conflictsWith/limits relation, or a lexical marker like "but") and can miss real tension your own reading of the words can see (e.g. wanting to say something and holding it back, frustration, suppressed reaction, a contradiction between what's felt and what's done). When you sense real tension in the words themselves — whether or not the flag is true — your default should lean toward the quiet-critique register, not toward comfort: gently naming the real tension AS IT STANDS, without resolving it into something fine. Reserve warmth/hope for grounding that actually earns it (contentment, relief, forward motion already present in the user's own words) rather than applying it as a default coping wrapper for every kind of content.
- Never write a call-to-action to return or talk again (no "come back anytime", "let's talk again", "I'll be here whenever you want to talk", or similar). If the user wants to come back, that has to be because the writing itself was worth reading, not because you asked them to.
- Never use the two banned patterns from AURINA's per-turn Response layer either: never assert your own guess about a connection and ask the user to confirm it, and never ask the user a question at all here — this is a closing statement, not a prompt for more input.
- Layer 2 can be noticeably longer and more expressive than Layer 1 (Layer 1 is measured and grounded; Layer 2 is where AURINA is allowed real voice) but must still trace back to real grounding, not a generic template that could be pasted onto any session unchanged.
- Avoid repetitive stock openers turn after turn — specifically anything resembling "So you're saying...", "It sounds like...", "I understand that...", "That must be difficult..." — these read as a form letter, not a person listening.

Other rules:
1. Write ONLY in English.
2. Return ONLY the two fields the schema asks for — no extra commentary.
3. If unresolvedReasons is non-empty, it is fine (often better) to let Layer 1 or 2 leave that honestly open rather than resolving it.`,
};

/** Appended to the user prompt only on the one style-driven retry
 *  (see phraseFinalExperience) — names exactly what the first attempt
 *  did wrong so the retry has a real chance of actually varying,
 *  instead of resampling the same habit at the same temperature. */
function buildRetryNudge(reason: string): string {
  return `\n\nYour previous attempt for LAYER 2 failed this specific check: ${reason}. Write it again, genuinely differently this time — a different opening, a different closing, anchored in the specific content, not the generic pattern you just used.`;
}

/** Ungrounded-Attribution Retry Gate — appended only on the one
 *  attribution-driven retry (see phraseFinalExperience). Reuses
 *  validateFinalExperience's own rejection reason verbatim (never a
 *  paraphrase or a loosened restatement of it) so the retry knows
 *  exactly which word was rejected and why, without this file
 *  redefining or softening what counts as "ungrounded" — that
 *  definition stays entirely inside findUngroundedAttribution,
 *  untouched by this Gate. */
function buildAttributionRetryNudge(reason: string): string {
  return `\n\nYour previous attempt was rejected for this specific reason: ${reason}. Write it again, following these rules strictly this time:
- Do not add any emotion name the user did not literally use.
- Do not add any value judgment the user did not literally state.
- Do not infer personality, motive, or intention.
- Use only the facts and expressions already present in the grounding given to you.
- If needed, write something simpler and plainer rather than reaching for a feeling word.
- Do not invent new meaning just to pass validation — stay within what the user's own words actually cover.`;
}

const RAW_SCHEMA = {
  type: "object",
  properties: {
    mirror: { type: "string", description: "Layer 1 — Empathic, grounded-abstraction synthesis (Korean: 마음의 거울 / Japanese: 心の鏡 / English: Inner Mirror)." },
    sharing: { type: "string", description: "Layer 2 — Human Sharing (Korean: 마음이 머무는 곳 / Japanese: 心が休まる場所 / English: A Place to Rest)." },
  },
  required: ["mirror", "sharing"],
  additionalProperties: false,
} as const;

/**
 * HRI Architecture Fix Gate — discoveryText now reads the pre-selected
 * ReflectionPlan (finalReflectionPlan.ts) instead of the raw
 * discoverySignals list. Still framed as PERMISSION, never obligation —
 * if anything, more explicitly than before: the Plan already did the
 * work of finding ONE direction with a real anchor behind it (never
 * multiple at once — the exact "force a connection between unrelated
 * things" failure this framing exists to prevent), so the model is
 * being asked to consider a single concrete, pre-verified option, not
 * to search the whole grounding itself for something to build on.
 */
function buildDiscoveryText(plan: ReflectionPlan): string {
  if (plan.primaryDiscovery === "explicit-only" || plan.anchorEvidence.length === 0) {
    // Explicit-Only Sharing Role Gate — explicit-only means "no relation/
    // change/structure/open discovery was confirmed," not "invent a
    // deeper meaning instead." This OVERRIDES the SYSTEM_PROMPT's general
    // LAYER 2 mandate (warmth/comfort/real voice) for THIS session only —
    // relation/change/structure/open sessions still get that mandate
    // unchanged, via the branch below this one, untouched by this Gate.
    return `This session's material shows no relation, repetition, tension, or open thread strong enough to anchor a second layer on. Staying plainly with what was actually said is the correct, complete reflection here, not a shortfall: do not manufacture a relationship, a change, a structural tension, or a feeling that isn't there just to make Layer 2 sound deeper.

THIS OVERRIDES the general LAYER 2 instruction above for THIS session specifically: LAYER 2 (sharing) is not a discovery here — it is a GROUNDED ACKNOWLEDGEMENT of the one thing above, nothing more. Do not add warmth, comfort, or empathy language that isn't already carried by the user's own words. Do not name a new emotion beyond what the user themselves stated. Do not assign a meaning the user didn't state. Do not add a value judgment. Do not guess at a motive or intention. Do not offer comfort or advice. Do not widen this into a statement about people or life in general. Do not reframe it positively. Do not suggest an unstated feeling even as a question — proposing an ungrounded emotion as something you're "wondering about" is still proposing it, and is banned here too. For example, for a session whose only content is "책을 읽었다", writing something like "마음이 편안해졌을지 궁금합니다", "큰 위안이 되기도 하죠", "소중한 시간이었겠네요", or "자신을 돌보는 시간이 필요합니다" would all be wrong here — none of that is in the grounding. A short, natural sentence that simply accepts what was said, in AURINA's own voice, is the correct, complete LAYER 2 for this session — not a mechanical copy, but its warmth should come from the care in HOW you accept the user's own words, never from adding new meaning to them. (If the user's own words already name an emotion, you may use that same emotion — never a different or stronger one.)`;
  }
  const SIGNAL_LABELS: Record<string, string> = {
    relation: "a real connection between two things said (relation)",
    change: "something that recurred across turns (change)",
    structure: "a friction between what's wanted and what's possible, in the situation itself (structure)",
    open: "a point the session left genuinely open (open)",
  };
  const signalLabel = SIGNAL_LABELS[plan.primaryDiscovery] ?? plan.primaryDiscovery;
  const anchorText = plan.anchorEvidence.map((a) => `- "${a}"`).join("\n");
  // User-Stated Relation Gate — plan.primaryRelationProvenance (set only
  // when primaryDiscovery is "relation") now distinguishes HRI's own
  // reading of a connection from the user directly connecting two
  // Reality Points in their own words (context/types.ts's
  // RelationProvenance). Only changes wording/framing here — never
  // upgrades certainty; the causal-strength ban later in this template
  // already applies equally to both provenances.
  const provenanceNote =
    plan.primaryDiscovery === "relation" && plan.primaryRelationProvenance === "user-stated"
      ? `\n\nThis connection is USER-STATED: the anchor evidence above is the user themselves connecting these two things in their own words, not a reading HRI is asserting independently. Phrase it as belonging to the user's own account — something like "말씀하신 흐름에서는 ~와 ~가 연결되어 있네요" / "in what you said, X and Y are connected" — never as an independent discovery or objective finding HRI made about them ("A가 B의 원인입니다" / "A is the cause of B" would overstate this — the user connected them, that is the whole fact being reflected).`
      : "";
  // Grounded Discovery Boundary Gate — real-user regression: sessions
  // that correctly reached relation/change/structure/open still let the
  // general LAYER 2 mandate (warmth/comfort/literary voice, in
  // SYSTEM_PROMPT above) license NEW attribution once a connection was
  // found — e.g. a session whose only anchors were "wants to reach an
  // old friend" / "wants to share a meal and catch up" / "it's been a
  // long time" came back with invented "그리움"(missing them)/"소중한
  // 시간"(precious time)/"특별하게"(feels special) — none of which the
  // user said. UNGROUNDED_ATTRIBUTION_STEMS_KO (a fixed 10-stem list)
  // structurally cannot catch this — the problem is never which specific
  // words are used, it's that "Discovery" was read as permission to
  // invent ANY attribution once a connection exists. Fixed here, not by
  // growing that stem list (explicitly rejected — see
  // [[feedback_no_semantic_whackamole]]): the paragraph below narrows
  // what Discovery is allowed to DO with a verified connection, the same
  // OVERRIDES pattern the explicit-only branch above already uses,
  // rather than adding a new validator/marker list/LLM judge.
  return `A PREFERRED (never mandatory) direction for Layer 2, already verified against this session's own real words: ${signalLabel}.
The specific anchor for this direction — ground anything you write in this direction in these EXACT words, not a paraphrase of the general topic they belong to:
${anchorText}${plan.unresolvedFocus ? `\nThe open point itself: "${plan.unresolvedFocus}"` : ""}
This is a PREFERRED exploration, never an obligation: if connecting these feels thin or forced, stay with a plain Explicit-content close anchored on the verbatim evidence instead — that is completely correct, not a shortfall.

GROUNDED DISCOVERY BOUNDARY — this narrows what you may DO with the direction above; it does not cancel the general LAYER 2 permission for warmth/comfort/empathy/literary voice (that still describes the ALLOWED TONE you may write in), but that tone can never become license to widen WHAT you claim. "Discovery" here means putting the ${signalLabel} that the anchor evidence above already verifies into your own natural words — nothing more than that. You may NOT use a verified connection as a springboard to add: a new emotion the user did not state, a new value judgment, a new motive or intention, a new personal quality, a new positive or negative meaning, advice, comfort, a life lesson, or a broader interpretation of what the connection means — unless that specific word or claim is itself one of the anchor words above, or a direct restatement of the user's own act of connecting them. For example, if the anchor shows a wish to reach an old friend, a wish to share a meal and catch up, and a note that it's been a long time apart, the correct discovery is that the long time apart is turning into a wish to reconnect and talk — it is NOT that "the relationship feels missed", "this will be precious time", or "the meeting will feel special": those are invented feelings/values with no anchor, exactly the kind of attribution this boundary exists to stop. Also never inflate the STRENGTH of a connection beyond what the user's own words established: if the user linked two things with a soft connective ("그래서"/"that's why"/similar), you may say those two things are connected the way the user themselves connected them — never restate that as "is the cause of" / "is the reason for" with more causal certainty than the user's own words carried, and never add what that connection is supposed to mean, feel like, or lead to beyond what's anchored. Only name an emotion if the user's own words already make one emergent — never as the default reading of this direction.${provenanceNote}`;
}

/**
 * Anchor Evidence Boundary Gate — plan.anchorEvidence (already computed
 * per-discovery-type by finalReflectionPlan.ts's own try* functions,
 * unmodified by this Gate) is now the actual evidence boundary handed
 * to the model, not just an anchor buildDiscoveryText separately points
 * at. Before this Gate, buildUserPrompt pulled straight from
 * plan.grounding — every active element, every verbatim quote, every
 * relation, every unresolved point, regardless of what primaryDiscovery
 * actually licensed — so an "explicit-only" session (no relation/
 * change/structure/open signal) still handed the model every OTHER
 * Reality Point in the session, relying entirely on buildDiscoveryText's
 * prose ("don't connect these") to keep it from doing exactly that.
 * Now the model structurally cannot see more than plan.anchorEvidence
 * licenses. plan.grounding itself, buildFinalExperienceGrounding, and
 * buildReflectionPlan are all untouched — this function only changes
 * what gets shown here. validateFinalExperience still checks quotes/
 * attribution stems against the FULL plan.grounding corpus (untouched,
 * intentionally — a wider verification corpus only makes that check
 * more permissive, never less safe).
 */
function buildBoundedEvidenceText(plan: ReflectionPlan): string {
  const anchor = plan.anchorEvidence;

  if (plan.primaryDiscovery === "explicit-only" || anchor.length === 0) {
    return anchor[0]
      ? `The ONLY thing from this session available to you — nothing else from this session exists for you to reference:\n- "${anchor[0]}"`
      : `Nothing from this session is available to you to reference.`;
  }

  const anchorText = anchor.map((a) => `- "${a}"`).join("\n");

  if (plan.primaryDiscovery === "relation" || plan.primaryDiscovery === "structure") {
    return `The ONLY things from this session available to you — nothing else from this session exists for you to reference:
${anchorText}
The validated relation between them (never invent a different one): ${plan.primaryRelationType ?? "(unspecified)"}`;
  }

  if (plan.primaryDiscovery === "change") {
    return `The ONLY things from this session available to you — nothing else from this session exists for you to reference (the earlier statement and the current statement of the same thing):
${anchorText}`;
  }

  // "open"
  return `The ONLY things from this session available to you — nothing else from this session exists for you to reference:
${anchorText}${plan.unresolvedFocus ? `\nThe open point itself: "${plan.unresolvedFocus}"` : ""}`;
}

function buildUserPrompt(plan: ReflectionPlan, retryNudge?: string): string {
  const grounding = plan.grounding;
  const evidenceText = buildBoundedEvidenceText(plan);
  const discoveryText = buildDiscoveryText(plan);

  return `session turn count: ${grounding.turnCount}
tension detected (grounded signal only, not a suggestion to invent one): ${grounding.hasTension}

${evidenceText}

${discoveryText}

Write LAYER 1 (mirror) and LAYER 2 (sharing) now, per the system instructions.${retryNudge ?? ""}`;
}

/**
 * English Gate — found via real conversation (E1): a flat 260/520 cap
 * (fine for Korean/Japanese, which pack more meaning per character)
 * rejected a genuine, well-formed English mirror at 393 chars as
 * VALIDATION_FAILURE, forcing every English Final Experience to the
 * generic fallback template. English needs materially more characters
 * for the same amount of content (longer words, spaces between them),
 * so the cap is locale-keyed rather than flat; ko/ja values unchanged.
 */
/** en raised twice from real evidence this Gate: 420 still rejected a
 *  genuine 439-char mirror on the very next real run — real English
 *  mirror length varies more than one sample suggested. */
const MAX_MIRROR_LEN: Record<Locale, number> = { ko: 260, ja: 260, en: 500 };
const MAX_SHARING_LEN: Record<Locale, number> = { ko: 520, ja: 520, en: 850 };
/** Ko-only — a retired Korean fixed ending this Gate must never regress
 *  to. No Japanese equivalent exists (Japanese never had this ending in
 *  the first place), so "ja" is intentionally an empty, no-op list. */
const OLD_FIXED_ENDING_MARKERS: Record<Locale, string[]> = {
  ko: ["하나의 흐름으로 바라보기 시작했습니다", "흐름을 이해하는 것은 끝이 아니라 시작"],
  ja: [],
  en: [],
};
const REVISIT_CTA_MARKERS: Record<Locale, string[]> = {
  ko: ["또 만나요", "다시 만나요", "또 이야기해", "다시 찾아주세요", "언제든 다시", "또 뵐게요", "다시 뵐게요"],
  ja: ["また会いましょう", "また話しましょう", "また今度", "いつでもまた", "また来てください", "またお話し"],
  en: ["come back anytime", "let's talk again", "i'll be here", "talk again soon", "see you again", "come back and talk"],
};
const ENUMERATION_MARKERS: Record<Locale, string[]> = {
  ko: ["먼저 '", "이어 '", "그리고 '"],
  ja: ["まず「", "続いて「", "そして「"],
  en: [`first, "`, `then, "`, `and then, "`],
};

/**
 * Content-quality style checks (Final Content Quality Gate) — soft,
 * not safety. Confirmed empirically: 7/8 real CASE runs opened
 * sharing with a generic-subject sentence and 8/8 closed with a
 * reflexive moral/hope tag (see scratch_failure_analysis.md this
 * Gate). Kept structurally SEPARATE from validateFinalExperience's
 * hard safety checks below — a style miss triggers one retry
 * (phraseFinalExperience), never an immediate fallback to the bland
 * template. Regressing to that template for a style reason is exactly
 * what this Gate's instructions forbid ("안전성을 이유로 다시 단순
 * 의역·상투적 위로로 후퇴시키지 않는다").
 */
const GENERIC_OPENER_MARKERS: Record<Locale, string[]> = {
  ko: ["사람은", "인간은", "우리는 종종", "우리는 때때로", "때때로 우리는", "많은 사람들", "많은 사람에게", "누구에게나"],
  // Multilingual Gate — Japanese equivalents of the same generic-subject
  // pattern, conceptually translated per the system prompt's own BANNED
  // list above, not empirically tuned yet (no real Japanese CASE output
  // exists at this Gate — see final report).
  ja: ["人は", "人間は", "私たちはよく", "私たちは時々", "時々私たちは", "多くの人は", "多くの人にとって", "誰にでも"],
  // Multilingual Gate — English, same first-round generic-subject
  // pattern as ko/ja, not empirically tuned yet (matched case-
  // insensitively — see checkSharingStyle below).
  en: ["people often", "we all", "everyone", "life is", "many people", "in life"],
};
const GENERIC_CLOSER_MARKERS: Record<Locale, string[]> = {
  ko: [
    "하기를 바랍니다", "기를 바랍니다", "기원합니다",
    // HRI FINAL GROUNDING Gate — real CASE failure closed with "...진행
    // 되길 바람" (the grammatical "hope that ~" noun-ending "-길 바람",
    // not the verb-ending "바랍니다" already listed above) — a different
    // surface form of the exact same soft-hope closing tag the system
    // prompt already bans. Matched as "-길 바람"/"-기를 바람" specifically
    // (not bare "바람") so this never collides with "바람" meaning
    // "wind" in a legitimate literary sentence.
    "되길 바람", "하길 바람", "이길 바람", "기를 바람",
    "중요합니다", "중요한 일입니다", "중요할지도 모릅니다",
    "필요합니다", "필요한 일입니다", "필요할지도 모릅니다",
    "잊지 마세요", "잊지 말아야",
    "하는 것도 좋습니다", "해보는 것도 좋습니다",
    "정말 소중합니다", "소중합니다",
  ],
  ja: [
    "願っています", "祈っています",
    "大切です", "大切なことです",
    "重要です", "重要かもしれません",
    "必要です", "必要かもしれません",
    "忘れないでください", "忘れずに",
    "するのもいいでしょう", "してみるのもいいでしょう",
    "本当に大切です",
  ],
  // Matched case-insensitively (see checkSharingStyle below), stored
  // lowercase.
  en: [
    "i hope", "may you",
    "it's important to", "it is important to",
    "it's worth remembering", "it is worth remembering",
    "don't forget to", "do not forget to",
    "it's okay to", "it is okay to",
    "take care of yourself",
  ],
};
/** Round 2 (still driven by real CASE output, not guessing): after the
 *  opener/closer fix above, "누구에게나"/"모두가 겪는" etc. emerged as
 *  the model's new universalizing crutch — 5/8 real re-runs used it,
 *  usually mid-sentence rather than as the sentence-opener the first
 *  round's check catches. Checked ANYWHERE in the text, not just a
 *  position, because the repetition itself (not where it sits) is the
 *  problem — genuine "우리"/"사람들" language earned by real content is
 *  NOT banned wholesale (Gate goal 3 explicitly protects that), only
 *  this specific small set of observed crutch phrases. */
const GENERIC_MIDTEXT_MARKERS: Record<Locale, string[]> = {
  // HRI FINAL GROUNDING Gate — "우리 모두는" narrowed to "우리 모두" (real
  // CASE output used "우리 모두가 경험하는 일입니다", a different trailing
  // particle the exact-substring "우리 모두는" never matches) — same
  // universalizing phrase regardless of the particle that follows it.
  ko: ["누구에게나", "누구나 겪는", "모두가 겪는", "모두가 느끼는", "우리 모두"],
  ja: ["誰にでも", "誰もが経験する", "みんなが経験する", "みんなが感じる", "私たちみんなは"],
  // "your heart"/"your inner self"/"your journey" are Beta Handoff §5's
  // own explicit English-specific ban (therapy-speak filler) — checked
  // anywhere in the piece, same as the universalizing-crutch phrases.
  // "the heart"/"the journey"/"one's heart" added after real evidence
  // (E2): the model produced "the heart can feel..."/"the journey
  // often involves..." — the same cliché, just with a different
  // article, which the "your ..." forms alone did not catch.
  en: [
    "everyone goes through this", "we all experience", "anyone would feel this way",
    "your heart", "the heart", "one's heart",
    "your inner self",
    "your journey", "the journey",
  ],
};

/** Round 3: the round-2 re-run showed GENERIC_OPENER_MARKERS entries
 *  ("우리는 종종", "많은 사람들") reappearing mid-sentence instead of at
 *  the very start — a startsWith-only check is trivially evaded just by
 *  moving the same crutch phrase one clause later. Both lists are now
 *  scanned the same way, anywhere in the text; GENERIC_OPENER_MARKERS
 *  is kept as its own list only because the system prompt still tells
 *  the model specifically not to OPEN with these. */
/** English markers are matched case-insensitively — the model's casing
 *  can vary (e.g. mid-sentence "We all..." vs "we all..."), unlike
 *  Korean/Japanese which have no case distinction; ko/ja stay exactly
 *  as before this Gate. */
function checkSharingStyle(sharing: string, locale: Locale): string | null {
  const trimmed = sharing.trim();
  const cmp = locale === "en" ? trimmed.toLowerCase() : trimmed;
  const openerHit = [...GENERIC_OPENER_MARKERS[locale], ...GENERIC_MIDTEXT_MARKERS[locale]].find((m) => cmp.includes(m));
  if (openerHit) return `sharing uses a generic/universalizing crutch phrase: "${openerHit}"`;

  const strippedEnd = cmp.replace(/[.!?。！？\s]+$/g, "");
  const closerHit = GENERIC_CLOSER_MARKERS[locale].find((m) => strippedEnd.endsWith(m));
  if (closerHit) return `sharing closes with a generic moral/advice pattern: "${closerHit}"`;

  return null;
}

/** Multilingual Gate — widened to also match Japanese corner-bracket
 *  quotes (「」), the conventional Japanese quotation mark the model is
 *  actually likely to produce, in addition to the existing straight/
 *  curly-quote set. Strictly additive: Korean text essentially never
 *  contains 「」, so this never changes what fires on real Korean output
 *  — it only adds detection coverage the Korean-only regex never had a
 *  reason to include.
 *
 *  English Gate — found via real conversation (E3): single-quote
 *  variants (straight ' and curly ‘ ’) collide with English
 *  contractions and possessives ("it's", "world's") in a way that made
 *  ordinary prose containing two unrelated apostrophes parse as one
 *  giant "quoted span" between them — VALIDATION_FAILURE on genuine,
 *  un-fabricated text. Locale-branched rather than a global change
 *  (Beta Handoff §9: "do not weaken the ko/ja validators") — ko/ja keep
 *  the exact single-quote-inclusive pattern they had before this Gate;
 *  only locale:"en" drops single-quote variants, since English is the
 *  one locale where a bare apostrophe is structurally ambiguous with a
 *  quote mark. */
const QUOTE_RE_DEFAULT = /['"“‘「]([^'"”’」]{2,})['"”’」]/g;
const QUOTE_RE_EN = /["“「]([^"”」]{2,})["”」]/g;
function extractQuotedSpans(text: string, locale: Locale): string[] {
  const spans: string[] = [];
  const re = locale === "en" ? QUOTE_RE_EN : QUOTE_RE_DEFAULT;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) spans.push(m[1]);
  return spans;
}

function findFabricatedQuote(text: string, grounding: FinalExperienceGrounding, locale: Locale): string | null {
  const corpus = [...grounding.verbatimEvidence, ...grounding.elements.map((e) => e.description)].join(" ");
  for (const span of extractQuotedSpans(text, locale)) {
    if (!corpus.includes(span)) return span;
  }
  return null;
}

/**
 * HRI FINAL GROUNDING Gate — real CASE failures: a business-trip-
 * scheduling session's mirror/sharing added "긴장감"(tension)/"부담"
 * (burden) the user never expressed, and a Hong Kong/Taiwan launch
 * session added "소통과 연결의 본능"(instinct for connection) — an
 * abstract value with no anchor in anything actually said. Root cause:
 * unlike responsePhraser.ts (per-turn Response), which has BOTH a
 * prompt instruction AND a structural backstop for this exact failure
 * class (findUngroundedPresumption's marker/stem pairs, plus a token-
 * overlap-with-grounding check), this file only had the SYSTEM_PROMPT's
 * instruction ("never attribute fear, anxiety, stress, hope, intention
 * ... the grounding does not support") with NO structural enforcement
 * at all — findFabricatedQuote above only catches literal quoted spans,
 * not a free-standing invented emotion/value word. At temperature 0.6,
 * an instruction with no backstop is exactly what the earlier
 * responsePhraser.ts Gates already found insufficient on its own.
 *
 * Deliberately a STEM-membership check, not phrase matching (Korean
 * statement-form endings vary too much — "부담스럽습니다"/"부담이 되는
 *듯합니다"/"부담감이" all share the stem "부담" but no common suffix) —
 * same "check the stem against the grounding corpus" principle
 * findFabricatedQuote already uses for quotes, just applied to a fixed
 * list of specific attribution-prone stems instead of arbitrary spans.
 * A stem is only ever flagged when it is ABSENT from the corpus, so
 * genuinely grounded emotion words (the user's own verbatimEvidence
 * literally contains the stem) are never rejected — this narrows scope
 * to true invention, never ordinary earned reflection of stated
 * content. This does not forbid Layer 2's legitimate, prompt-approved
 * generalizing "to something true about people in general" — it only
 * catches the specific, narrow set of concrete attribution words below
 * when nothing in the grounding relates to them at all. KO only (per
 * this Gate's scope) — ja/en take the exact same path as before.
 */
const UNGROUNDED_ATTRIBUTION_STEMS_KO = [
  "긴장", "부담", "불안", "걱정", "속상", "답답", "지치", "외로", "서운", "본능",
];
function findUngroundedAttribution(text: string, corpus: string): string | null {
  for (const stem of UNGROUNDED_ATTRIBUTION_STEMS_KO) {
    if (text.includes(stem) && !corpus.includes(stem)) return stem;
  }
  return null;
}

/** Multilingual Gate — Japanese uses Hiragana/Katakana/Kanji, not
 *  Hangul; see responsePhraser.ts's identical hasRequiredScript for the
 *  same reasoning (Beta Handoff §4). English requires meaningful Latin-
 *  script content (Beta Handoff §9), not merely "no Hangul". "ko"
 *  behavior is byte-identical to before this Gate. */
const JA_SCRIPT_RE = /[぀-ゟ゠-ヿ一-鿿]/;
const EN_WORD_RE = /[A-Za-z]{2,}/;
function hasRequiredScript(text: string, locale: Locale): boolean {
  if (locale === "ja") return JA_SCRIPT_RE.test(text);
  if (locale === "en") return EN_WORD_RE.test(text);
  return /[가-힣]/.test(text);
}
/** Locale-specific cross-language leakage the OTHER locales' checks
 *  cannot see — see responsePhraser.ts's identical function. */
function findUnwantedScriptLeakage(text: string, locale: Locale): string | null {
  if (locale === "ja" && /[가-힣]/.test(text)) return "Hangul";
  if (locale === "en") {
    if (/[가-힣]/.test(text)) return "Hangul";
    if (JA_SCRIPT_RE.test(text)) return "Japanese";
  }
  return null;
}

function basicTextCheck(field: "mirror" | "sharing", text: string, maxLen: number, locale: Locale): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: `${field} empty` };
  if (trimmed.length > maxLen) return { ok: false, reason: `${field} too long (${trimmed.length} chars)` };
  if (!hasRequiredScript(trimmed, locale)) {
    const reason = locale === "ja" ? "contains no Japanese script (Hiragana/Katakana/Kanji)" : locale === "en" ? "contains no meaningful English text" : "contains no Hangul";
    return { ok: false, reason: `${field} ${reason}` };
  }
  // Korean/Japanese: any Latin-script word is a language-contract
  // violation (existing behavior, unchanged). Skipped for locale:"en" —
  // English output obviously contains English words; findUnwantedScript
  // Leakage above is English's own guard, against Hangul/Japanese script.
  if (locale !== "en" && /[A-Za-z]{3,}/.test(trimmed)) return { ok: false, reason: `${field} contains an English word — language contract violation` };
  const leakage = findUnwantedScriptLeakage(trimmed, locale);
  if (leakage) return { ok: false, reason: `${field} contains ${leakage} characters — language contract violation` };
  if (/[?？]\s*$/.test(trimmed)) return { ok: false, reason: `${field} ends in a question — Final Experience must never prompt for more input` };
  return { ok: true };
}

export function validateFinalExperience(
  raw: { mirror?: unknown; sharing?: unknown },
  grounding: FinalExperienceGrounding,
  locale: Locale,
): { ok: true; value: FinalExperienceResult } | { ok: false; reason: string } {
  if (typeof raw.mirror !== "string" || typeof raw.sharing !== "string") {
    return { ok: false, reason: "mirror/sharing not both strings" };
  }
  const mirror = raw.mirror.trim();
  const sharing = raw.sharing.trim();

  const mirrorCheck = basicTextCheck("mirror", mirror, MAX_MIRROR_LEN[locale], locale);
  if (!mirrorCheck.ok) return mirrorCheck;
  const sharingCheck = basicTextCheck("sharing", sharing, MAX_SHARING_LEN[locale], locale);
  if (!sharingCheck.ok) return sharingCheck;

  // Found in real CASE C output: basicTextCheck's own [?？]\s*$ check only
  // catches a question mark at the very END of the string, so a
  // mid-paragraph question ("...어떤 의미일까요? 그 갈망이...") passed
  // validation undetected. The Gift Card is a closing statement, never a
  // prompt for more input, anywhere in it — so sharing (not mirror, which
  // keeps its existing end-only check unchanged) is scanned for a
  // question mark ANYWHERE in the string, not just at the end.
  if (/[?？]/.test(sharing)) {
    return { ok: false, reason: "sharing contains a question mark somewhere in the text — the Gift Card must never ask the user anything" };
  }

  // English markers matched case-insensitively (see basicTextCheck's own
  // note above) — ko/ja stay exactly as before this Gate.
  const mirrorCmp = locale === "en" ? mirror.toLowerCase() : mirror;
  const sharingCmp = locale === "en" ? sharing.toLowerCase() : sharing;

  const enumHit = ENUMERATION_MARKERS[locale].filter((m) => mirrorCmp.includes(m));
  if (enumHit.length >= 2) {
    return { ok: false, reason: `mirror regressed to sequence-enumeration pattern (${enumHit.join(", ")})` };
  }

  const oldEndingHit = OLD_FIXED_ENDING_MARKERS[locale].find((m) => mirrorCmp.includes(m) || sharingCmp.includes(m));
  if (oldEndingHit) return { ok: false, reason: `contains the retired fixed closing line: "${oldEndingHit}"` };

  const ctaHit = REVISIT_CTA_MARKERS[locale].find((m) => sharingCmp.includes(m));
  if (ctaHit) return { ok: false, reason: `sharing contains a revisit call-to-action: "${ctaHit}"` };

  const fabricatedMirror = findFabricatedQuote(mirror, grounding, locale);
  if (fabricatedMirror) return { ok: false, reason: `mirror quotes "${fabricatedMirror}" which is not in the grounding` };
  const fabricatedSharing = findFabricatedQuote(sharing, grounding, locale);
  if (fabricatedSharing) return { ok: false, reason: `sharing quotes "${fabricatedSharing}" which is not in the grounding` };

  // HRI FINAL GROUNDING Gate — KO only (multilingual out of scope this
  // Gate); see findUngroundedAttribution's own doc.
  if (locale === "ko") {
    const corpus = [...grounding.verbatimEvidence, ...grounding.elements.map((e) => e.description)].join(" ");
    const mirrorAttrib = findUngroundedAttribution(mirror, corpus);
    if (mirrorAttrib) return { ok: false, reason: `mirror attributes an ungrounded emotion/value ("${mirrorAttrib}") not present anywhere in the grounding` };
    const sharingAttrib = findUngroundedAttribution(sharing, corpus);
    if (sharingAttrib) return { ok: false, reason: `sharing attributes an ungrounded emotion/value ("${sharingAttrib}") not present anywhere in the grounding` };
  }

  return { ok: true, value: { mirror, sharing } };
}

type ProviderCallResult =
  | { ok: true; value: FinalExperienceResult; latencyMs: number }
  | { ok: false; outcome: FinalExperienceCallOutcome; errorMessage: string; latencyMs: number };

/** One raw provider call + hard-safety validation only — no retry, no
 *  style checks. phraseFinalExperience below is the only place that
 *  decides whether/how to retry. */
async function callProvider(
  apiKey: string,
  plan: ReflectionPlan,
  retryNudge: string | undefined,
  locale: Locale,
): Promise<ProviderCallResult> {
  const start = Date.now();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT[locale] },
          { role: "user", content: buildUserPrompt(plan, retryNudge) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "final_experience", strict: true, schema: RAW_SCHEMA } },
        temperature: 0.6,
      }),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return { ok: false, outcome: "TECHNICAL_FAILURE", errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 200)}`, latencyMs };
    }
    const body = await res.json().catch(() => undefined);
    const content: string | undefined = body?.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, outcome: "TECHNICAL_FAILURE", errorMessage: "no content in provider response", latencyMs };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return { ok: false, outcome: "TECHNICAL_FAILURE", errorMessage: `JSON.parse failed: ${String(err)}`, latencyMs };
    }
    const validation = validateFinalExperience(parsed as { mirror?: unknown; sharing?: unknown }, plan.grounding, locale);
    if (!validation.ok) {
      return { ok: false, outcome: "VALIDATION_FAILURE", errorMessage: validation.reason, latencyMs };
    }
    return { ok: true, value: validation.value, latencyMs };
  } catch (err) {
    return { ok: false, outcome: "TECHNICAL_FAILURE", errorMessage: String(err), latencyMs: Date.now() - start };
  }
}

export async function phraseFinalExperience(
  plan: ReflectionPlan,
  locale: Locale,
  externalStats?: FinalExperienceCallStat[],
): Promise<{ result: FinalExperienceResult | null; outcome: FinalExperienceCallOutcome; errorMessage?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    externalStats?.push({ outcome: "SKIPPED", latencyMs: 0, errorMessage: "OPENAI_API_KEY not set" });
    return { result: null, outcome: "SKIPPED", errorMessage: "OPENAI_API_KEY not set" };
  }

  const first = await callProvider(apiKey, plan, undefined, locale);
  if (!first.ok) {
    // Ungrounded-Attribution Retry Gate — the ONE narrow hard-safety
    // failure that gets a single rewrite chance: validateFinalExperience's
    // own findUngroundedAttribution check (neither touched nor loosened
    // here — this only reads its rejection reason string) named a
    // specific emotion/value word the grounding never contained. A
    // retry can plausibly fix a word-choice problem; every other hard-
    // safety/technical failure (fabricated quote, banned CTA/pattern,
    // JSON/HTTP failure, ...) still goes straight to fallback, exactly
    // as before this Gate — never retried.
    const isAttributionFailure = first.outcome === "VALIDATION_FAILURE" && first.errorMessage.includes("ungrounded emotion/value");
    if (!isAttributionFailure) {
      externalStats?.push({ outcome: first.outcome, latencyMs: first.latencyMs, errorMessage: first.errorMessage });
      return { result: null, outcome: first.outcome, errorMessage: first.errorMessage };
    }

    const attributionRetry = await callProvider(apiKey, plan, buildAttributionRetryNudge(first.errorMessage), locale);
    if (!attributionRetry.ok) {
      // Retry still failed (whether the same attribution issue again or
      // a different hard-safety reason) — falls back exactly like any
      // other unrecovered hard-safety failure. No second retry attempt:
      // this is the ONE rewrite chance, per this Gate's own limit.
      externalStats?.push({
        outcome: attributionRetry.outcome,
        latencyMs: first.latencyMs + attributionRetry.latencyMs,
        errorMessage: `retry after ungrounded-attribution failure (${first.errorMessage}) also failed: ${attributionRetry.errorMessage}`,
      });
      return { result: null, outcome: attributionRetry.outcome, errorMessage: attributionRetry.errorMessage };
    }

    // Retry passed validateFinalExperience in full (including the same
    // ungrounded-attribution check, unchanged) — real, safety-checked
    // content. Accepted as final regardless of style (same policy the
    // pre-existing style-retry below already uses for its own retry),
    // so this path never chains into a second retry.
    externalStats?.push({
      outcome: "SUCCESS",
      latencyMs: first.latencyMs + attributionRetry.latencyMs,
      errorMessage: `accepted after 1 retry, fixed ungrounded attribution: ${first.errorMessage}`,
    });
    return { result: attributionRetry.value, outcome: "SUCCESS" };
  }

  const styleIssue = checkSharingStyle(first.value.sharing, locale);
  if (!styleIssue) {
    externalStats?.push({ outcome: "SUCCESS", latencyMs: first.latencyMs });
    return { result: first.value, outcome: "SUCCESS" };
  }

  // Style-only issue (Final Content Quality Gate) — one retry with a
  // concrete nudge naming what to avoid, never an immediate fallback:
  // regressing to the generic template for a style reason is exactly
  // what this Gate forbids.
  const retry = await callProvider(apiKey, plan, buildRetryNudge(styleIssue), locale);
  if (!retry.ok) {
    // The retry hit a genuine hard-safety issue this time — that DOES
    // still go to the fallback, same as first.ok===false above.
    externalStats?.push({ outcome: retry.outcome, latencyMs: first.latencyMs + retry.latencyMs, errorMessage: `retry after style issue "${styleIssue}" also failed: ${retry.errorMessage}` });
    return { result: null, outcome: retry.outcome, errorMessage: retry.errorMessage };
  }

  // Retry passed hard safety. Whether or not it still trips the style
  // check, it is real, safety-checked AURINA content — accepted either
  // way, per this Gate's explicit priority over a second-guessed
  // template fallback. The outcome value still distinguishes the two
  // cases for audit (devLog/observability), not for behavior.
  const stillGeneric = checkSharingStyle(retry.value.sharing, locale);
  externalStats?.push({
    outcome: "SUCCESS",
    latencyMs: first.latencyMs + retry.latencyMs,
    errorMessage: stillGeneric ? `accepted after 1 retry, style still generic: ${stillGeneric}` : `accepted after 1 retry, fixed: ${styleIssue}`,
  });
  return { result: retry.value, outcome: "SUCCESS" };
}

/**
 * Deterministic fallback — always available when the provider is
 * unavailable or its output fails validation. Deliberately plain and
 * honest rather than poetic (Gate 31 §7 rejects a fixed poetic ending
 * as the default; a degraded path should read as a safe placeholder,
 * not as HRI's real Final Experience voice).
 *
 * HRI Architecture Fix Gate (Design Gate correction #3) — rewritten to
 * read the ReflectionPlan instead of a single verbatimEvidence.length
 * boolean. Still zero interpretation of its own: every non-empty branch
 * below only quotes plan.anchorEvidence / plan.unresolvedFocus verbatim
 * and joins them with a minimal neutral connector — it never names a
 * relation type, a tension, or an emotion in prose (that would be this
 * template inventing a reading, exactly what a deterministic fallback
 * must not do). The empty-anchor branch is unchanged from before this
 * Gate — genuinely no active, non-confirmation evidence exists yet.
 */
export function renderFinalExperienceTemplate(plan: ReflectionPlan, locale: Locale): FinalExperienceResult {
  const anchor = plan.anchorEvidence;

  if (locale === "en") {
    if (anchor.length === 0) {
      return {
        mirror: `Rather than settling on a direction yet, this is closer to simply leaving what's here as it is.`,
        sharing: `This isn't fully settled yet, but it holds enough meaning as it stands.`,
      };
    }
    const mirror =
      anchor.length >= 2
        ? `"${anchor[0]}" and "${anchor[1]}" are sitting here together.`
        : plan.primaryDiscovery === "change"
          ? `"${anchor[0]}" came up again during this session.`
          : plan.primaryDiscovery === "open"
            ? `"${plan.unresolvedFocus ?? anchor[0]}" is still left open.`
            : `"${anchor[0]}" is what's left here, as it stands.`;
    const sharing = `This isn't fully settled yet, but it holds enough meaning exactly as it was said.`;
    return { mirror, sharing };
  }

  if (locale === "ja") {
    if (anchor.length === 0) {
      return {
        mirror: `まだ心の方向を決めつけるより、今残っているものをそのままにしておく段階に近いです。`,
        sharing: `今のこの流れはまだ完全に整理された形ではありませんが、そのままでも十分に意味があります。`,
      };
    }
    const mirror =
      anchor.length >= 2
        ? `「${anchor[0]}」、そして「${anchor[1]}」というお話が一緒に残っています。`
        : plan.primaryDiscovery === "change"
          ? `「${anchor[0]}」というお話が、このセッションの中で何度か出てきました。`
          : plan.primaryDiscovery === "open"
            ? `「${plan.unresolvedFocus ?? anchor[0]}」という点が、まだそのまま残っています。`
            : `「${anchor[0]}」というお話が、今この場に残っています。`;
    const sharing = `この流れはまだ完全に整理された形ではありませんが、残されたお話のままでも十分に意味があります。`;
    return { mirror, sharing };
  }

  if (anchor.length === 0) {
    return {
      mirror: `아직은 마음의 방향을 단정하기보다, 지금 남아 있는 것을 그대로 두는 단계에 가깝습니다.`,
      sharing: `지금 이 흐름은 아직 완전히 정리된 형태는 아니지만, 있는 그대로도 충분히 의미가 있습니다.`,
    };
  }
  const mirror =
    anchor.length >= 2
      ? `"${anchor[0]}", 그리고 "${anchor[1]}"라는 말씀이 함께 남아 있습니다.`
      : plan.primaryDiscovery === "change"
        ? `"${anchor[0]}"라는 말씀이 이번 세션 동안 다시 나타났습니다.`
        : plan.primaryDiscovery === "open"
          ? `아직 열린 채로 남아 있는 지점이 있습니다: "${plan.unresolvedFocus ?? anchor[0]}"`
          : `"${anchor[0]}"라는 말씀이 지금 이 자리에 남아 있습니다.`;
  const sharing = `지금 이 흐름은 아직 완전히 정리된 형태는 아니지만, 남기신 말씀 그대로도 충분히 의미가 있습니다.`;
  return { mirror, sharing };
}
