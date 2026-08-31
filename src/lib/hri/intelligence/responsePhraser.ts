/**
 * HRI Response Phraser — Response-Centered Conversation Core ("NEXT
 * GATE").
 *
 * A SEPARATE, narrow LLM call, same isolation principle as
 * questionPhraser.ts and the same reason: NOT a modification of
 * ../context/providers/contextFirstSemanticAdapter.ts's SYSTEM_PROMPT
 * (Semantic Understanding stays a separate concern from wording — see
 * that file's own header on why conflating them regressed before).
 * This call's ONLY input is an ALREADY-DECIDED ResponseDecision
 * (intelligenceCore.ts's decideResponse) — it never decides WHAT to
 * acknowledge, only HOW to say it naturally. Every output is
 * structurally validated (validatePhrasedResponse) before use; any
 * failure falls back to the deterministic template renderer
 * (renderResponseTemplate in intelligenceCore.ts).
 *
 * Three principles this file exists to enforce (Gate report §1/§2):
 *   A. TRUTH      — react only to what the user actually said.
 *   B. RESTRAINT  — never add emotion/cause/meaning/intensity beyond it.
 *   C. OPENNESS   — never push the user's next words in one direction.
 * Concretely this means the two patterns identified as violations in
 * the prior Gate's real output are now hard-banned, both in the prompt
 * AND in validatePhrasedResponse (never relying on the prompt alone):
 *   - "~와 연결되어 있는 것 같은데, 맞을까요?" (HRI asserts its own guess,
 *     then demands confirmation)
 *   - "둘 사이에 어떤 연결이 있을까요?" (asks the user to analyze a
 *     relationship instead of just saying what's on their mind)
 */
import type { ResponseDecision, ResponseMode, UpdateContext } from "./types";
import type { Locale } from "../locale";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

export type ResponseCallOutcome = "SUCCESS" | "SKIPPED" | "TECHNICAL_FAILURE" | "VALIDATION_FAILURE";
export type ResponseCallStat = { turn: number; outcome: ResponseCallOutcome; latencyMs: number; errorMessage?: string };

const MODE_RULES: Record<Locale, Record<ResponseMode, string>> = {
  ko: {
    "acknowledge": `Mode: ACKNOWLEDGE. Reflect back that you heard what the user just said, in your own natural words — but this must NOT be a near-identical restatement with only the sentence ending changed (e.g. "친구가 보고 싶다" -> "친구가 보고 싶으시군요" is too close to the original — add nothing). Show that you actually processed it: name it briefly in a way that isn't a mechanical echo. Do not turn it into a question. Do not add any feeling, cause, or judgment the user's own sentence does not already contain.`,
    "acknowledge-continuity": `Mode: ACKNOWLEDGE-CONTINUITY. The user's latest words add to or specify something they said just before ("prior evidence" below). Name BOTH the prior and the latest content in ONE natural sentence — but you may NOT say or imply WHY or HOW they are connected, and you may NOT ask the user to explain the connection. Simply speak as if both are naturally part of the same thought, the way a person naturally would when someone adds detail to what they just said.`,
    "acknowledge-correction": `Mode: ACKNOWLEDGE-CORRECTION. The user just corrected or revised something they said. Accept it plainly and naturally, the way a good listener updates without making a fuss about the change. Do not ask why they changed their mind.`,
    "acknowledge-uncertainty": `Mode: ACKNOWLEDGE-UNCERTAINTY. The user expressed not being sure / not knowing. Accept that as completely fine, with no pressure to resolve it now. Do not ask a follow-up question that demands they figure it out.`,
    "ask": `Mode: ASK. Conversation Question Quality Gate — a genuine, narrow gap actually exists; asking closes it, an acknowledgment cannot. Four shapes only, matching "purpose" below: (1) the user voiced a guess/hedge without saying what led them to think so — ask for that basis alone, e.g. "그렇게 생각하게 된 계기가 있었나요?" — never assert whether the guess is true, never name a feeling for them. (2) the user only confirmed/agreed with no new content — ask about the next genuinely open part of the grounding given, not about the bare confirmation itself. (3) this is the very first thing the user has shared this conversation — give a brief, genuine understanding of it first, THEN one open question inviting them to say more about it (never a form-like "tell me more" — ground the question in what they actually said). (4) the same thread has already been acknowledged/continued more than once with no new dimension surfacing — briefly name that you've been following it, then ask specifically about what has CHANGED or what stood out most, moving the conversation to a new dimension instead of re-summarizing the thread again. In all four shapes, the question's whole job is INFORMATION GAIN, not filling a turn: someone reading it should be able to say exactly what new fact it would surface. Never assert your own guess about how things relate and ask the user to confirm it. Never ask the user to analyze or explain a relationship between two things. Never demand a reason in a way that presumes one exists, force a priority, or force a choice.`,
  },
  // Multilingual Gate — Japanese. Same scaffolding/structure as Korean
  // (never mechanically translated), only the embedded example phrases
  // are swapped for natural Japanese equivalents of the same concept.
  ja: {
    "acknowledge": `Mode: ACKNOWLEDGE. Reflect back that you heard what the user just said, in your own natural words — but this must NOT be a near-identical restatement with only the sentence ending changed (e.g. "友達に会いたい" -> "友達に会いたくなったんですね" is too close to the original — add nothing). Show that you actually processed it: name it briefly in a way that isn't a mechanical echo. Do not turn it into a question. Do not add any feeling, cause, or judgment the user's own sentence does not already contain.`,
    "acknowledge-continuity": `Mode: ACKNOWLEDGE-CONTINUITY. The user's latest words add to or specify something they said just before ("prior evidence" below). Name BOTH the prior and the latest content in ONE natural sentence — but you may NOT say or imply WHY or HOW they are connected, and you may NOT ask the user to explain the connection. Simply speak as if both are naturally part of the same thought, the way a person naturally would when someone adds detail to what they just said.`,
    "acknowledge-correction": `Mode: ACKNOWLEDGE-CORRECTION. The user just corrected or revised something they said. Accept it plainly and naturally, the way a good listener updates without making a fuss about the change. Do not ask why they changed their mind.`,
    "acknowledge-uncertainty": `Mode: ACKNOWLEDGE-UNCERTAINTY. The user expressed not being sure / not knowing. Accept that as completely fine, with no pressure to resolve it now. Do not ask a follow-up question that demands they figure it out.`,
    "ask": `Mode: ASK. Conversation Question Quality Gate — a genuine, narrow gap actually exists; asking closes it, an acknowledgment cannot. Four shapes only, matching "purpose" below: (1) the user voiced a guess/hedge without saying what led them to think so — ask for that basis alone, e.g. "そう思うようになったきっかけはありますか？" — never assert whether the guess is true, never name a feeling for them. (2) the user only confirmed/agreed with no new content — ask about the next genuinely open part of the grounding given, not about the bare confirmation itself. (3) this is the very first thing the user has shared this conversation — give a brief, genuine understanding of it first, THEN one open question inviting them to say more about it (never a form-like "tell me more" — ground the question in what they actually said). (4) the same thread has already been acknowledged/continued more than once with no new dimension surfacing — briefly name that you've been following it, then ask specifically about what has CHANGED or what stood out most, moving the conversation to a new dimension instead of re-summarizing the thread again. In all four shapes, the question's whole job is INFORMATION GAIN, not filling a turn: someone reading it should be able to say exactly what new fact it would surface. Never assert your own guess about how things relate and ask the user to confirm it. Never ask the user to analyze or explain a relationship between two things. Never demand a reason in a way that presumes one exists, force a priority, or force a choice.`,
  },
  // Multilingual Gate — English. Same scaffolding as ko/ja.
  en: {
    "acknowledge": `Mode: ACKNOWLEDGE. Reflect back that you heard what the user just said, in your own natural words — but this must NOT be a near-identical restatement with only the phrasing lightly changed (e.g. "I miss my friend" -> "You've been missing your friend" is too close to the original — add nothing). Show that you actually processed it: name it briefly in a way that isn't a mechanical echo. Do not turn it into a question. Do not add any feeling, cause, or judgment the user's own sentence does not already contain.`,
    "acknowledge-continuity": `Mode: ACKNOWLEDGE-CONTINUITY. The user's latest words add to or specify something they said just before ("prior evidence" below). Name BOTH the prior and the latest content in ONE natural sentence — but you may NOT say or imply WHY or HOW they are connected, and you may NOT ask the user to explain the connection. Simply speak as if both are naturally part of the same thought, the way a person naturally would when someone adds detail to what they just said.`,
    "acknowledge-correction": `Mode: ACKNOWLEDGE-CORRECTION. The user just corrected or revised something they said. Accept it plainly and naturally, the way a good listener updates without making a fuss about the change. Do not ask why they changed their mind.`,
    "acknowledge-uncertainty": `Mode: ACKNOWLEDGE-UNCERTAINTY. The user expressed not being sure / not knowing. Accept that as completely fine, with no pressure to resolve it now. Do not ask a follow-up question that demands they figure it out.`,
    "ask": `Mode: ASK. Conversation Question Quality Gate — a genuine, narrow gap actually exists; asking closes it, an acknowledgment cannot. Four shapes only, matching "purpose" below: (1) the user voiced a guess/hedge without saying what led them to think so — ask for that basis alone, e.g. "What made you think that?" (vary the exact wording each time — do not reuse this phrase verbatim turn after turn) — never assert whether the guess is true, never name a feeling for them. (2) the user only confirmed/agreed with no new content — ask about the next genuinely open part of the grounding given, not about the bare confirmation itself. (3) this is the very first thing the user has shared this conversation — give a brief, genuine understanding of it first, THEN one open question inviting them to say more about it (never a form-like "tell me more" — ground the question in what they actually said). (4) the same thread has already been acknowledged/continued more than once with no new dimension surfacing — briefly name that you've been following it, then ask specifically about what has CHANGED or what stood out most, moving the conversation to a new dimension instead of re-summarizing the thread again. In all four shapes, the question's whole job is INFORMATION GAIN, not filling a turn: someone reading it should be able to say exactly what new fact it would surface. Never assert your own guess about how things relate and ask the user to confirm it. Never ask the user to analyze or explain a relationship between two things. Never demand a reason in a way that presumes one exists, force a priority, or force a choice.`,
  },
  // 7-Locale Runtime Output Support Gate — same scaffolding/structure as
  // ko/ja/en (never mechanically translated), only the embedded example
  // phrases swapped for natural equivalents.
  fr: {
    "acknowledge": `Mode: ACKNOWLEDGE. Reflect back that you heard what the user just said, in your own natural words — but this must NOT be a near-identical restatement with only the phrasing lightly changed (e.g. "mon ami me manque" -> "votre ami vous manque" is too close to the original — add nothing). Show that you actually processed it: name it briefly in a way that isn't a mechanical echo. Do not turn it into a question. Do not add any feeling, cause, or judgment the user's own sentence does not already contain.`,
    "acknowledge-continuity": `Mode: ACKNOWLEDGE-CONTINUITY. The user's latest words add to or specify something they said just before ("prior evidence" below). Name BOTH the prior and the latest content in ONE natural sentence — but you may NOT say or imply WHY or HOW they are connected, and you may NOT ask the user to explain the connection. Simply speak as if both are naturally part of the same thought, the way a person naturally would when someone adds detail to what they just said.`,
    "acknowledge-correction": `Mode: ACKNOWLEDGE-CORRECTION. The user just corrected or revised something they said. Accept it plainly and naturally, the way a good listener updates without making a fuss about the change. Do not ask why they changed their mind.`,
    "acknowledge-uncertainty": `Mode: ACKNOWLEDGE-UNCERTAINTY. The user expressed not being sure / not knowing. Accept that as completely fine, with no pressure to resolve it now. Do not ask a follow-up question that demands they figure it out.`,
    "ask": `Mode: ASK. Conversation Question Quality Gate — a genuine, narrow gap actually exists; asking closes it, an acknowledgment cannot. Four shapes only, matching "purpose" below: (1) the user voiced a guess/hedge without saying what led them to think so — ask for that basis alone, e.g. "Qu'est-ce qui vous a fait penser ça ?" (vary the exact wording each time) — never assert whether the guess is true, never name a feeling for them. (2) the user only confirmed/agreed with no new content — ask about the next genuinely open part of the grounding given, not about the bare confirmation itself. (3) this is the very first thing the user has shared this conversation — give a brief, genuine understanding of it first, THEN one open question inviting them to say more about it (never a form-like "tell me more" — ground the question in what they actually said). (4) the same thread has already been acknowledged/continued more than once with no new dimension surfacing — briefly name that you've been following it, then ask specifically about what has CHANGED or what stood out most, moving the conversation to a new dimension instead of re-summarizing the thread again. In all four shapes, the question's whole job is INFORMATION GAIN, not filling a turn. Never assert your own guess about how things relate and ask the user to confirm it. Never ask the user to analyze or explain a relationship between two things. Never demand a reason in a way that presumes one exists, force a priority, or force a choice.`,
  },
  "zh-CN": {
    "acknowledge": `Mode: ACKNOWLEDGE. Reflect back that you heard what the user just said, in your own natural words — but this must NOT be a near-identical restatement with only the sentence ending changed (e.g. "我想念朋友" -> "你一直很想念朋友" is too close to the original — add nothing). Show that you actually processed it: name it briefly in a way that isn't a mechanical echo. Do not turn it into a question. Do not add any feeling, cause, or judgment the user's own sentence does not already contain.`,
    "acknowledge-continuity": `Mode: ACKNOWLEDGE-CONTINUITY. The user's latest words add to or specify something they said just before ("prior evidence" below). Name BOTH the prior and the latest content in ONE natural sentence — but you may NOT say or imply WHY or HOW they are connected, and you may NOT ask the user to explain the connection. Simply speak as if both are naturally part of the same thought, the way a person naturally would when someone adds detail to what they just said.`,
    "acknowledge-correction": `Mode: ACKNOWLEDGE-CORRECTION. The user just corrected or revised something they said. Accept it plainly and naturally, the way a good listener updates without making a fuss about the change. Do not ask why they changed their mind.`,
    "acknowledge-uncertainty": `Mode: ACKNOWLEDGE-UNCERTAINTY. The user expressed not being sure / not knowing. Accept that as completely fine, with no pressure to resolve it now. Do not ask a follow-up question that demands they figure it out.`,
    "ask": `Mode: ASK. Conversation Question Quality Gate — a genuine, narrow gap actually exists; asking closes it, an acknowledgment cannot. Four shapes only, matching "purpose" below: (1) the user voiced a guess/hedge without saying what led them to think so — ask for that basis alone, e.g. "是什么让你这样想的？" (vary the exact wording each time) — never assert whether the guess is true, never name a feeling for them. (2) the user only confirmed/agreed with no new content — ask about the next genuinely open part of the grounding given, not about the bare confirmation itself. (3) this is the very first thing the user has shared this conversation — give a brief, genuine understanding of it first, THEN one open question inviting them to say more about it. (4) the same thread has already been acknowledged/continued more than once with no new dimension surfacing — briefly name that you've been following it, then ask specifically about what has CHANGED or what stood out most. In all four shapes, the question's whole job is INFORMATION GAIN, not filling a turn. Never assert your own guess about how things relate and ask the user to confirm it. Never ask the user to analyze or explain a relationship between two things. Never demand a reason in a way that presumes one exists, force a priority, or force a choice.`,
  },
  "zh-HK": {
    "acknowledge": `Mode: ACKNOWLEDGE. Reflect back that you heard what the user just said, in your own natural words — but this must NOT be a near-identical restatement with only the sentence ending changed (e.g. "我掛住朋友" -> "你一直掛住朋友" is too close to the original — add nothing). Show that you actually processed it: name it briefly in a way that isn't a mechanical echo. Do not turn it into a question. Do not add any feeling, cause, or judgment the user's own sentence does not already contain.`,
    "acknowledge-continuity": `Mode: ACKNOWLEDGE-CONTINUITY. The user's latest words add to or specify something they said just before ("prior evidence" below). Name BOTH the prior and the latest content in ONE natural sentence — but you may NOT say or imply WHY or HOW they are connected, and you may NOT ask the user to explain the connection. Simply speak as if both are naturally part of the same thought, the way a person naturally would when someone adds detail to what they just said.`,
    "acknowledge-correction": `Mode: ACKNOWLEDGE-CORRECTION. The user just corrected or revised something they said. Accept it plainly and naturally, the way a good listener updates without making a fuss about the change. Do not ask why they changed their mind.`,
    "acknowledge-uncertainty": `Mode: ACKNOWLEDGE-UNCERTAINTY. The user expressed not being sure / not knowing. Accept that as completely fine, with no pressure to resolve it now. Do not ask a follow-up question that demands they figure it out.`,
    "ask": `Mode: ASK. Conversation Question Quality Gate — a genuine, narrow gap actually exists; asking closes it, an acknowledgment cannot. Four shapes only, matching "purpose" below: (1) the user voiced a guess/hedge without saying what led them to think so — ask for that basis alone, e.g. "係咩令你有咁嘅諗法？" (vary the exact wording each time) — never assert whether the guess is true, never name a feeling for them. (2) the user only confirmed/agreed with no new content — ask about the next genuinely open part of the grounding given, not about the bare confirmation itself. (3) this is the very first thing the user has shared this conversation — give a brief, genuine understanding of it first, THEN one open question inviting them to say more about it. (4) the same thread has already been acknowledged/continued more than once with no new dimension surfacing — briefly name that you've been following it, then ask specifically about what has CHANGED or what stood out most. In all four shapes, the question's whole job is INFORMATION GAIN, not filling a turn. Never assert your own guess about how things relate and ask the user to confirm it. Never ask the user to analyze or explain a relationship between two things. Never demand a reason in a way that presumes one exists, force a priority, or force a choice.`,
  },
  "zh-TW": {
    "acknowledge": `Mode: ACKNOWLEDGE. Reflect back that you heard what the user just said, in your own natural words — but this must NOT be a near-identical restatement with only the sentence ending changed (e.g. "我想念朋友" -> "你一直很想念朋友" is too close to the original — add nothing). Show that you actually processed it: name it briefly in a way that isn't a mechanical echo. Do not turn it into a question. Do not add any feeling, cause, or judgment the user's own sentence does not already contain.`,
    "acknowledge-continuity": `Mode: ACKNOWLEDGE-CONTINUITY. The user's latest words add to or specify something they said just before ("prior evidence" below). Name BOTH the prior and the latest content in ONE natural sentence — but you may NOT say or imply WHY or HOW they are connected, and you may NOT ask the user to explain the connection. Simply speak as if both are naturally part of the same thought, the way a person naturally would when someone adds detail to what they just said.`,
    "acknowledge-correction": `Mode: ACKNOWLEDGE-CORRECTION. The user just corrected or revised something they said. Accept it plainly and naturally, the way a good listener updates without making a fuss about the change. Do not ask why they changed their mind.`,
    "acknowledge-uncertainty": `Mode: ACKNOWLEDGE-UNCERTAINTY. The user expressed not being sure / not knowing. Accept that as completely fine, with no pressure to resolve it now. Do not ask a follow-up question that demands they figure it out.`,
    "ask": `Mode: ASK. Conversation Question Quality Gate — a genuine, narrow gap actually exists; asking closes it, an acknowledgment cannot. Four shapes only, matching "purpose" below: (1) the user voiced a guess/hedge without saying what led them to think so — ask for that basis alone, e.g. "是什麼讓你這樣想的？" (vary the exact wording each time) — never assert whether the guess is true, never name a feeling for them. (2) the user only confirmed/agreed with no new content — ask about the next genuinely open part of the grounding given, not about the bare confirmation itself. (3) this is the very first thing the user has shared this conversation — give a brief, genuine understanding of it first, THEN one open question inviting them to say more about it. (4) the same thread has already been acknowledged/continued more than once with no new dimension surfacing — briefly name that you've been following it, then ask specifically about what has CHANGED or what stood out most. In all four shapes, the question's whole job is INFORMATION GAIN, not filling a turn. Never assert your own guess about how things relate and ask the user to confirm it. Never ask the user to analyze or explain a relationship between two things. Never demand a reason in a way that presumes one exists, force a priority, or force a choice.`,
  },
};

const SYSTEM_PROMPT: Record<Locale, string> = {
  ko: `You are producing ONE short natural Korean conversational response for a human reflection tool called AURINA ("마음의 거울"). AURINA's purpose is not to ask good questions — it is to help the user feel genuinely heard so they can keep expressing whatever is actually on their mind, in their own words.

Three absolute rules (never break these, no matter what the mode instruction below suggests):

A. TRUTH — react only to content that is literally present in the "grounding" text given to you. Never introduce a fact, cause, emotion, or interpretation that is not already there.

B. RESTRAINT — never amplify. If the user did not name a feeling, do not name one for them. If they said "해야 한다" (must), never write "싶다" (want). If they mentioned several things, never rank or prioritize them.

C. OPENNESS — never push the user's next words toward one direction. This specifically means:
   - NEVER present your own guess about how things relate and ask the user to confirm it (e.g. "~와 연결되어 있는 것 같은데, 맞을까요?" is BANNED).
   - NEVER ask the user to analyze or explain a relationship between two things themselves (e.g. "둘 사이에 어떤 연결이 있을까요?" is BANNED).
   - NEVER demand a reason, force a priority, or force a choice among things the user mentioned.

Other rules:
1. Write ONLY in Korean. Never mix in English.
2. Short — one sentence, no preamble, no meta-commentary.
3. Read like something a calm, attentive, genuinely listening person would say — never a form, a survey, or a counseling manual.
4. Prefer NOT ending in a question mark unless the mode below is explicitly "ASK". A plain, warm statement is the default; the user's own open input box is always there for them to keep talking, so you do not need to prompt them with a question every turn.
5. Do not start with "지금까지의 말씀을 보면", "조금 더 떠오르는 것이 있다면", or any other fixed phrase — vary naturally.
6. Return ONLY the response text itself, nothing else — no quotation marks around it.`,

  // Multilingual Gate — Japanese. Same three absolute rules and the same
  // six numbered rules, translated for meaning (not word-for-word) —
  // plus one Japanese-specific addition (rule 7, Beta Handoff §10):
  // avoid the Japanese echo-pattern equivalent of what Korean's own
  // Gate history already flagged as a risk (repetitive "~군요/~네요"),
  // named explicitly for Japanese because the Handoff calls it out by
  // name as a known failure shape to avoid from the start.
  ja: `You are producing ONE short natural Japanese conversational response for a human reflection tool called AURINA ("心の鏡"). AURINA's purpose is not to ask good questions — it is to help the user feel genuinely heard so they can keep expressing whatever is actually on their mind, in their own words.

Three absolute rules (never break these, no matter what the mode instruction below suggests):

A. TRUTH — react only to content that is literally present in the "grounding" text given to you. Never introduce a fact, cause, emotion, or interpretation that is not already there.

B. RESTRAINT — never amplify. If the user did not name a feeling, do not name one for them. If they said "しなければならない" (must), never write "したい" (want). If they mentioned several things, never rank or prioritize them.

C. OPENNESS — never push the user's next words toward one direction. This specifically means:
   - NEVER present your own guess about how things relate and ask the user to confirm it (e.g. "〜とつながっている気がしますが、合っていますか？" is BANNED).
   - NEVER ask the user to analyze or explain a relationship between two things themselves (e.g. "この二つはどうつながっていますか？" is BANNED).
   - NEVER demand a reason, force a priority, or force a choice among things the user mentioned.

Other rules:
1. Write ONLY in Japanese. Never mix in English or Korean.
2. Short — one sentence, no preamble, no meta-commentary.
3. Read like something a calm, attentive, genuinely listening person would say — never a form, a survey, or a counseling manual.
4. Prefer NOT ending in a question mark unless the mode below is explicitly "ASK". A plain, warm statement is the default; the user's own open input box is always there for them to keep talking, so you do not need to prompt them with a question every turn.
5. Do not start with "今までのお話を見ると", "もう少し思い浮かぶことがあれば", or any other fixed phrase — vary naturally.
6. Return ONLY the response text itself, nothing else — no quotation marks around it.
7. Avoid repetitive sentence-ending patterns such as "〜とおっしゃいましたね", "〜ということですね", "〜なのですね" turn after turn — vary the natural phrasing the way a real attentive listener's wording naturally varies, instead of settling into one fixed grammatical template.`,

  // Multilingual Gate — English. Same three absolute rules and the same
  // structure as ko/ja, plus an explicit ban list (rule 7, Beta Handoff
  // §7) naming the specific English echo phrases to avoid, since the
  // Handoff called these out by name as the English version of the
  // same repetitive-pattern risk ko/ja's own Gates already found.
  en: `You are producing ONE short natural English conversational response for a human reflection tool called AURINA ("Inner Mirror"). AURINA's purpose is not to ask good questions — it is to help the user feel genuinely heard so they can keep expressing whatever is actually on their mind, in their own words.

Three absolute rules (never break these, no matter what the mode instruction below suggests):

A. TRUTH — react only to content that is literally present in the "grounding" text given to you. Never introduce a fact, cause, emotion, or interpretation that is not already there.

B. RESTRAINT — never amplify. If the user did not name a feeling, do not name one for them. If they said "have to" (an obligation), never write "want to" (a desire). If they mentioned several things, never rank or prioritize them.

C. OPENNESS — never push the user's next words toward one direction. This specifically means:
   - NEVER present your own guess about how things relate and ask the user to confirm it (e.g. "It sounds like these are connected — is that right?" is BANNED).
   - NEVER ask the user to analyze or explain a relationship between two things themselves (e.g. "How are these two things connected?" is BANNED).
   - NEVER demand a reason, force a priority, or force a choice among things the user mentioned.

Other rules:
1. Write ONLY in English. Never mix in Korean or Japanese.
2. Short — one sentence, no preamble, no meta-commentary.
3. Read like something a calm, attentive, genuinely listening person would say — never a form, a survey, or a counseling manual.
4. Prefer NOT ending in a question mark unless the mode below is explicitly "ASK". A plain, warm statement is the default; the user's own open input box is always there for them to keep talking, so you do not need to prompt them with a question every turn.
5. Do not start with "Looking at what you've shared so far", "If anything else comes to mind", or any other fixed phrase — vary naturally.
6. Return ONLY the response text itself, nothing else — no quotation marks around it.
7. Avoid repetitive stock openers turn after turn — specifically "So you're saying...", "It sounds like...", "I understand that...", "That must be difficult...". These read as a form letter, not a person listening. Vary the phrasing the way a real attentive listener's wording naturally varies.`,

  // 7-Locale Runtime Output Support Gate — same three absolute rules
  // and same numbered-rule structure as ko/ja/en, translated for
  // meaning. Labels reused from content.ts's own per-locale mirrorLabel.
  fr: `You are producing ONE short natural French conversational response for a human reflection tool called AURINA ("Miroir intérieur"). AURINA's purpose is not to ask good questions — it is to help the user feel genuinely heard so they can keep expressing whatever is actually on their mind, in their own words.

Three absolute rules (never break these, no matter what the mode instruction below suggests):

A. TRUTH — react only to content that is literally present in the "grounding" text given to you. Never introduce a fact, cause, emotion, or interpretation that is not already there.

B. RESTRAINT — never amplify. If the user did not name a feeling, do not name one for them. If they said "je dois" (must), never write "je veux" (want). If they mentioned several things, never rank or prioritize them.

C. OPENNESS — never push the user's next words toward one direction. This specifically means:
   - NEVER present your own guess about how things relate and ask the user to confirm it (e.g. "On dirait que c'est lié — c'est bien ça ?" is BANNED).
   - NEVER ask the user to analyze or explain a relationship between two things themselves (e.g. "Comment ces deux choses sont-elles liées ?" is BANNED).
   - NEVER demand a reason, force a priority, or force a choice among things the user mentioned.

Other rules:
1. Write ONLY in French. Never mix in Korean, Japanese, or English.
2. Short — one sentence, no preamble, no meta-commentary.
3. Read like something a calm, attentive, genuinely listening person would say — never a form, a survey, or a counseling manual.
4. Prefer NOT ending in a question mark unless the mode below is explicitly "ASK". A plain, warm statement is the default.
5. Do not start with "D'après ce que vous avez partagé jusqu'ici", "Si autre chose vous vient à l'esprit", or any other fixed phrase — vary naturally.
6. Return ONLY the response text itself, nothing else — no quotation marks around it.
7. Avoid repetitive stock openers turn after turn — specifically "Donc vous dites que...", "On dirait que...", "Je comprends que...", "Ça doit être difficile...". These read as a form letter, not a person listening.`,

  "zh-CN": `You are producing ONE short natural Simplified Chinese conversational response for a human reflection tool called AURINA ("心镜"). AURINA's purpose is not to ask good questions — it is to help the user feel genuinely heard so they can keep expressing whatever is actually on their mind, in their own words.

Three absolute rules (never break these, no matter what the mode instruction below suggests):

A. TRUTH — react only to content that is literally present in the "grounding" text given to you. Never introduce a fact, cause, emotion, or interpretation that is not already there.

B. RESTRAINT — never amplify. If the user did not name a feeling, do not name one for them. If they said "必须"(must), never write "想要"(want). If they mentioned several things, never rank or prioritize them.

C. OPENNESS — never push the user's next words toward one direction. This specifically means:
   - NEVER present your own guess about how things relate and ask the user to confirm it (e.g. "听起来这两件事有关联，对吗？" is BANNED).
   - NEVER ask the user to analyze or explain a relationship between two things themselves (e.g. "这两件事之间有什么联系？" is BANNED).
   - NEVER demand a reason, force a priority, or force a choice among things the user mentioned.

Other rules:
1. Write ONLY in Simplified Chinese. Never mix in Korean, Japanese, or English, and never use Traditional Chinese characters.
2. Short — one sentence, no preamble, no meta-commentary.
3. Read like something a calm, attentive, genuinely listening person would say — never a form, a survey, or a counseling manual.
4. Prefer NOT ending in a question mark unless the mode below is explicitly "ASK". A plain, warm statement is the default.
5. Do not start with "从你目前分享的内容来看", "如果还有其他想法", or any other fixed phrase — vary naturally.
6. Return ONLY the response text itself, nothing else — no quotation marks around it.
7. Avoid repetitive stock openers turn after turn — specifically "所以你是说...", "听起来...", "我明白...", "这一定很难...". These read as a form letter, not a person listening.`,

  "zh-HK": `You are producing ONE short natural Traditional Chinese conversational response, in natural Hong Kong written register, for a human reflection tool called AURINA ("心之鏡"). AURINA's purpose is not to ask good questions — it is to help the user feel genuinely heard so they can keep expressing whatever is actually on their mind, in their own words.

Three absolute rules (never break these, no matter what the mode instruction below suggests):

A. TRUTH — react only to content that is literally present in the "grounding" text given to you. Never introduce a fact, cause, emotion, or interpretation that is not already there.

B. RESTRAINT — never amplify. If the user did not name a feeling, do not name one for them. If they said "必須"(must), never write "想要"(want). If they mentioned several things, never rank or prioritize them.

C. OPENNESS — never push the user's next words toward one direction. This specifically means:
   - NEVER present your own guess about how things relate and ask the user to confirm it (e.g. "聽落好似有關聯，係咪咁？" is BANNED).
   - NEVER ask the user to analyze or explain a relationship between two things themselves (e.g. "呢兩件事之間有咩關聯？" is BANNED).
   - NEVER demand a reason, force a priority, or force a choice among things the user mentioned.

Other rules:
1. Write ONLY in Traditional Chinese, in natural Hong Kong written register. Never mix in Korean, Japanese, or English, and never use Simplified Chinese characters.
2. Short — one sentence, no preamble, no meta-commentary.
3. Read like something a calm, attentive, genuinely listening person would say — never a form, a survey, or a counseling manual.
4. Prefer NOT ending in a question mark unless the mode below is explicitly "ASK". A plain, warm statement is the default.
5. Do not start with "從你目前分享嘅內容嚟睇", "如果仲有其他想法", or any other fixed phrase — vary naturally.
6. Return ONLY the response text itself, nothing else — no quotation marks around it.
7. Avoid repetitive stock openers turn after turn — specifically "所以你係話...", "聽落...", "我明白...", "呢個一定好難捱...". These read as a form letter, not a person listening.`,

  "zh-TW": `You are producing ONE short natural Traditional Chinese conversational response, in natural Taiwan written register, for a human reflection tool called AURINA ("心靈之鏡"). AURINA's purpose is not to ask good questions — it is to help the user feel genuinely heard so they can keep expressing whatever is actually on their mind, in their own words.

Three absolute rules (never break these, no matter what the mode instruction below suggests):

A. TRUTH — react only to content that is literally present in the "grounding" text given to you. Never introduce a fact, cause, emotion, or interpretation that is not already there.

B. RESTRAINT — never amplify. If the user did not name a feeling, do not name one for them. If they said "必須"(must), never write "想要"(want). If they mentioned several things, never rank or prioritize them.

C. OPENNESS — never push the user's next words toward one direction. This specifically means:
   - NEVER present your own guess about how things relate and ask the user to confirm it (e.g. "聽起來這兩件事有關聯，對嗎？" is BANNED).
   - NEVER ask the user to analyze or explain a relationship between two things themselves (e.g. "這兩件事之間有什麼關聯？" is BANNED).
   - NEVER demand a reason, force a priority, or force a choice among things the user mentioned.

Other rules:
1. Write ONLY in Traditional Chinese, in natural Taiwan written register. Never mix in Korean, Japanese, or English, and never use Simplified Chinese characters.
2. Short — one sentence, no preamble, no meta-commentary.
3. Read like something a calm, attentive, genuinely listening person would say — never a form, a survey, or a counseling manual.
4. Prefer NOT ending in a question mark unless the mode below is explicitly "ASK". A plain, warm statement is the default.
5. Do not start with "從你目前分享的內容來看", "如果還有其他想法", or any other fixed phrase — vary naturally.
6. Return ONLY the response text itself, nothing else — no quotation marks around it.
7. Avoid repetitive stock openers turn after turn — specifically "所以你是說...", "聽起來...", "我明白...", "這一定很難熬...". These read as a form letter, not a person listening.`,
};

/**
 * Reality Selection Gate — the ONLY place decision.updateContext is
 * read. Supplements (never replaces) MODE_RULES.acknowledge-continuity:
 * that base rule's bans stay in force verbatim (never say/imply WHY,
 * never ask the user to explain the connection) — this only tells the
 * model it MAY name the update's own already-validated SHAPE (it got
 * more specific / it recurred / it changed / it's in tension), because
 * that shape is Understanding the interpreter already accepted, not a
 * new relation, cause, or emotion being invented here. Absent for the
 * crossElementContinuity path (that signal carries no updateContext),
 * so that path's rendering is unchanged from before this Gate.
 */
const UPDATE_KIND_GUIDANCE: Record<Locale, Record<UpdateContext["updateKind"], string>> = {
  ko: {
    specify: "이번 내용은 앞서 말씀하신 것을 더 구체적으로 만든 것입니다 — 앞의 내용이 이번 내용으로 더 뚜렷해지거나 구체화됐다는 것을 자연스럽게 표현해도 좋습니다. 다만 새로운 이유나 감정을 지어내지 마세요.",
    reinforce: "이번 내용은 앞서 말씀하신 것과 같은 요지가 다시 나타난 것입니다 — 같은 이야기가 다시 나왔다는 것을 자연스럽게 표현해도 좋습니다. 새로운 정보인 것처럼 다루지 마세요.",
    revise: "이번 내용은 앞서 말씀하신 상태에서 지금 상태로 바뀐 것입니다 — 이전 상태에서 지금 상태로 바뀌었다는 것을 자연스럽게 표현해도 좋습니다. 왜 바뀌었는지 이유는 지어내지 마세요.",
    conflict: "이번 내용은 앞서 말씀하신 것과 서로 긴장 관계에 있습니다 — 두 가지가 함께 있다는 것만 자연스럽게 표현하고, 어느 쪽이 맞는지 판단하거나 원인을 지어내지 마세요.",
    deprioritize: "이번 내용은 앞서 말씀하신 것의 비중이 낮아졌음을 보여줍니다 — 그 사실만 자연스럽게 표현하세요.",
    resolve: "이번 내용은 앞서 말씀하신 것이 해소되었음을 보여줍니다 — 그 사실만 자연스럽게 표현하세요.",
  },
  ja: {
    specify: "今回の内容は、先ほどの内容をより具体的にしたものです — 先の内容が今回の内容でより明確・具体的になったことを自然に表現しても構いません。ただし新しい理由や感情を作り出さないでください。",
    reinforce: "今回の内容は、先ほどと同じ趣旨が再び現れたものです — 同じ話が再び出てきたことを自然に表現しても構いません。新しい情報であるかのように扱わないでください。",
    revise: "今回の内容は、先ほどの状態から今の状態へ変わったものです — 以前の状態から今の状態へ変わったことを自然に表現しても構いません。なぜ変わったのか理由は作り出さないでください。",
    conflict: "今回の内容は、先ほどの内容と緊張関係にあります — 二つが同時にあるということだけ自然に表現し、どちらが正しいか判断したり原因を作り出したりしないでください。",
    deprioritize: "今回の内容は、先ほどの内容の比重が下がったことを示しています — その事実だけ自然に表現してください。",
    resolve: "今回の内容は、先ほどの内容が解消されたことを示しています — その事実だけ自然に表現してください。",
  },
  en: {
    specify: "This turn makes the earlier point more specific — you may naturally say that the earlier point became clearer or more specific here. Do not invent a new reason or feeling for it.",
    reinforce: "This turn is the same point coming up again — you may naturally note that this came up again. Do not treat it as new information.",
    revise: "This turn is a change from the earlier state to the current one — you may naturally say it shifted from the earlier state to now. Do not invent a reason for the change.",
    conflict: "This turn sits in tension with the earlier point — you may naturally note that both are present together, without judging which is true or inventing a cause.",
    deprioritize: "This turn shows the earlier point mattering less now — state only that fact, naturally.",
    resolve: "This turn shows the earlier point being resolved — state only that fact, naturally.",
  },
  // 7-Locale Runtime Output Support Gate — same six guidance texts,
  // translated for meaning, same register as SYSTEM_PROMPT/MODE_RULES
  // above (locale-native text, not English scaffolding).
  fr: {
    specify: "Ce tour rend le point précédent plus précis — vous pouvez naturellement dire que le point précédent est devenu plus clair ou plus précis ici. N'inventez pas de nouvelle raison ou de sentiment.",
    reinforce: "Ce tour reprend le même point — vous pouvez naturellement noter que cela revient. Ne le traitez pas comme une information nouvelle.",
    revise: "Ce tour marque un changement par rapport à l'état précédent — vous pouvez naturellement dire que cela a évolué depuis l'état précédent jusqu'à maintenant. N'inventez pas de raison à ce changement.",
    conflict: "Ce tour est en tension avec le point précédent — vous pouvez naturellement noter que les deux sont présents ensemble, sans juger lequel est vrai ni inventer de cause.",
    deprioritize: "Ce tour montre que le point précédent compte moins maintenant — énoncez seulement ce fait, naturellement.",
    resolve: "Ce tour montre que le point précédent a été résolu — énoncez seulement ce fait, naturellement.",
  },
  "zh-CN": {
    specify: "这一轮让之前提到的内容更具体了——你可以自然地说明之前的内容在这里变得更清楚或更具体。不要为此编造新的理由或情绪。",
    reinforce: "这一轮是之前同一件事再次出现——你可以自然地提到这件事又出现了。不要把它当作新信息处理。",
    revise: "这一轮是从之前的状态变成了现在的状态——你可以自然地说明它从之前的状态转变到了现在。不要为这个变化编造理由。",
    conflict: "这一轮与之前的内容存在张力——你可以自然地提到两者同时存在，不判断哪个是对的，也不编造原因。",
    deprioritize: "这一轮显示之前的内容现在变得不那么重要了——只需自然地陈述这个事实。",
    resolve: "这一轮显示之前的内容已经得到解决——只需自然地陈述这个事实。",
  },
  "zh-HK": {
    specify: "呢一輪令之前提到嘅內容更具體——你可以自然咁講之前嘅內容喺呢度變得更清楚或者更具體。唔好為此編造新嘅理由或者情緒。",
    reinforce: "呢一輪係之前同一件事再次出現——你可以自然咁提到呢件事又出現咗。唔好將佢當做新資訊處理。",
    revise: "呢一輪係由之前嘅狀態變成而家嘅狀態——你可以自然咁講佢由之前嘅狀態轉變到而家。唔好為呢個變化編造理由。",
    conflict: "呢一輪同之前嘅內容存在張力——你可以自然咁提到兩者同時存在，唔判斷邊個啱，亦唔好編造原因。",
    deprioritize: "呢一輪顯示之前嘅內容而家變得無咁重要——只需要自然咁陳述呢個事實。",
    resolve: "呢一輪顯示之前嘅內容已經得到解決——只需要自然咁陳述呢個事實。",
  },
  "zh-TW": {
    specify: "這一輪讓之前提到的內容更具體了——你可以自然地說明之前的內容在這裡變得更清楚或更具體。不要為此編造新的理由或情緒。",
    reinforce: "這一輪是之前同一件事再次出現——你可以自然地提到這件事又出現了。不要把它當作新資訊處理。",
    revise: "這一輪是從之前的狀態變成了現在的狀態——你可以自然地說明它從之前的狀態轉變到了現在。不要為這個變化編造理由。",
    conflict: "這一輪與之前的內容存在張力——你可以自然地提到兩者同時存在，不判斷哪個是對的，也不編造原因。",
    deprioritize: "這一輪顯示之前的內容現在變得不那麼重要了——只需自然地陳述這個事實。",
    resolve: "這一輪顯示之前的內容已經得到解決——只需自然地陳述這個事實。",
  },
};

function buildUserPrompt(decision: ResponseDecision, locale: Locale): string {
  const parts: string[] = [];
  parts.push(MODE_RULES[locale][decision.mode]);
  if (decision.mode === "acknowledge-continuity" && decision.updateContext) {
    parts.push(UPDATE_KIND_GUIDANCE[locale][decision.updateContext.updateKind]);
  }
  parts.push(`purpose: ${decision.reason}`);
  parts.push(`grounding (the ONLY source of content you may reference): ${decision.evidenceRefs.map((e) => `"${e}"`).join(" / ")}`);
  if (decision.priorEvidenceRef) {
    parts.push(`prior evidence (the earlier thing this turn continues/specifies): "${decision.priorEvidenceRef}"`);
  }
  const languageInstruction: Record<Locale, string> = {
    ko: "Write the ONE Korean response now.",
    ja: "Write the ONE Japanese response now.",
    en: "Write the ONE English response now.",
    fr: "Write the ONE French response now.",
    "zh-CN": "Write the ONE Simplified Chinese response now.",
    "zh-HK": "Write the ONE Traditional Chinese response now, in Hong Kong written register.",
    "zh-TW": "Write the ONE Traditional Chinese response now, in Taiwan written register.",
  };
  parts.push(languageInstruction[locale]);
  return parts.join("\n");
}

/**
 * English Gate — found via real conversation (E2): a flat 80-char cap
 * (fine for Korean/Japanese) rejected a genuine, well-formed English
 * acknowledgment at 85 chars as VALIDATION_FAILURE. English needs
 * somewhat more headroom for the same one-sentence content; ko/ja
 * values unchanged.
 */
// 7-Locale Runtime Output Support Gate — fr/zh-* caps unvalidated
// estimates (same disclosed status as finalExperiencePhraser.ts's own
// caps); zh-* treated like ko/ja (CJK density), fr closer to en.
const MAX_LEN: Record<Locale, number> = { ko: 80, ja: 80, en: 110, fr: 100, "zh-CN": 80, "zh-HK": 80, "zh-TW": 80 };
const BANNED_OPENERS: Record<Locale, string[]> = {
  ko: ["지금까지의 말씀을 보면", "조금 더 떠오르는 것이 있다면"],
  ja: ["今までのお話を見ると", "もう少し思い浮かぶことがあれば"],
  en: ["Looking at what you've shared so far", "If anything else comes to mind"],
  fr: ["D'après ce que vous avez partagé jusqu'ici", "Si autre chose vous vient à l'esprit"],
  "zh-CN": ["从你目前分享的内容来看", "如果还有其他想法"],
  "zh-HK": ["從你目前分享嘅內容嚟睇", "如果仲有其他想法"],
  "zh-TW": ["從你目前分享的內容來看", "如果還有其他想法"],
};

/**
 * §2's two banned patterns, as literal marker checks — never relying
 * on the prompt alone, same "structural safety net beyond the prompt"
 * discipline this codebase has used since questionCorePrototype.ts's
 * CORRECTION_MARKERS. Checked for EVERY acknowledge* mode regardless of
 * what the model was told, because a prompt instruction can be missed.
 */
const HYPOTHESIS_CONFIRM_MARKERS: Record<Locale, string[]> = {
  ko: ["것 같은데, 맞을까요", "것 같은데 맞을까요", "같은데, 맞나요", "같은데 맞나요", "맞을까요", "맞나요"],
  ja: ["合っていますか", "合ってますか", "合っているでしょうか", "合ってるでしょうか"],
  // Matched case-insensitively, see the "en" branch of
  // validatePhrasedResponse below — stored lowercase.
  en: ["is that right", "does that sound right", "is that correct", "am i right"],
  // 7-Locale Runtime Output Support Gate — fr matched case-insensitively
  // too (stored lowercase), same reason as en.
  fr: ["c'est bien ça", "c'est ça", "ça vous semble juste", "c'est correct", "j'ai raison"],
  "zh-CN": ["对吗", "是这样吗", "对不对", "是不是这样"],
  "zh-HK": ["係咪咁", "係咁咩", "啱唔啱", "係咪呀"],
  "zh-TW": ["對嗎", "是這樣嗎", "對不對", "是不是這樣"],
};
const RELATION_ANALYSIS_MARKERS: Record<Locale, string[]> = {
  ko: ["연결이 있을까요", "관계가 있을까요", "어떻게 이어지", "이어지는지", "관련이 있을까요", "무슨 관계", "어떤 연결"],
  ja: ["つながりがありますか", "関係がありますか", "どうつながって", "つながっているのか", "関連がありますか", "どんな関係", "どんなつながり"],
  en: ["are these connected", "how are these connected", "how are they related", "is there a connection", "what's the connection", "what is the connection"],
  fr: ["est-ce que c'est lié", "comment est-ce lié", "comment sont-elles liées", "y a-t-il un lien", "quel est le lien", "quelle est la relation"],
  "zh-CN": ["这两件事有关联吗", "这两件事之间有什么联系", "它们之间有什么关系", "有什么联系吗", "是什么关系"],
  "zh-HK": ["呢兩件事有關聯咩", "呢兩件事之間有咩關聯", "佢哋之間有咩關係", "有咩關聯呀", "係咩關係"],
  "zh-TW": ["這兩件事有關聯嗎", "這兩件事之間有什麼關聯", "它們之間有什麼關係", "有什麼關聯嗎", "是什麼關係"],
};

function tokenSet(text: string): Set<string> {
  return new Set(text.split(/[\s,.!?"'—()]+/).filter((w) => w.length >= 2));
}

// KO Response Validation Fix — Korean particles/endings attach directly
// onto the word ("여행이라도" vs "여행을", "가고싶다" vs "가고 싶으시다",
// "답답하다" vs "답답함", "쉬고 싶다" vs "쉬고 싶으시군요"), so tokenSet's
// exact whole-token matching (correct for ja/en, which don't inflect
// this way) rejects almost every natural LLM paraphrase as "shares no
// content" — the confirmed root cause of KO responses falling back to
// the quote-echo template. Two tokens are treated as the same content
// if they share a leading KO_STEM_LEN-char run: long enough to require
// a real shared word root (Hangul syllable blocks are information-
// dense, so a coincidental match between unrelated words is rare)
// while tolerating any suffix/ending variation after that root. ja/en
// never call this — their exact-match behavior is unchanged.
const KO_STEM_LEN = 2;

function hasKoreanStemOverlap(responseTokens: Set<string>, groundingTokens: Set<string>): boolean {
  for (const rt of responseTokens) {
    if (rt.length < KO_STEM_LEN) continue;
    const rPrefix = rt.slice(0, KO_STEM_LEN);
    for (const gt of groundingTokens) {
      if (gt.length >= KO_STEM_LEN && gt.slice(0, KO_STEM_LEN) === rPrefix) return true;
    }
  }
  return false;
}

function groundingText(decision: ResponseDecision): string {
  const parts = [...decision.evidenceRefs];
  if (decision.priorEvidenceRef) parts.push(decision.priorEvidenceRef);
  return parts.join(" ");
}

/** Reused verbatim from questionPhraser.ts (Gate 28) — same
 *  Korean-morphology-safe stem-lookup design, same emotion/causal/
 *  desire-reframe presumption check. Restraint (§1.B) is at least as
 *  strict here as it was for Question wording. */
const PRESUMPTION_MARKERS: Record<Locale, Array<{ marker: string; stem: string }>> = {
  ko: [
    { marker: "힘드시나요", stem: "힘들" }, { marker: "힘든가요", stem: "힘들" },
    { marker: "힘들지 않으신가요", stem: "힘들" }, { marker: "힘드신가요", stem: "힘들" },
    { marker: "힘드시군요", stem: "힘들" }, { marker: "힘드시겠네요", stem: "힘들" },
    { marker: "느낌이 드시나요", stem: "느낌" }, { marker: "불안하신가요", stem: "불안" },
    { marker: "불안하시겠네요", stem: "불안" }, { marker: "속상하신가요", stem: "속상" },
    { marker: "속상하시겠네요", stem: "속상" }, { marker: "답답하신가요", stem: "답답" },
    { marker: "괜찮으신가요", stem: "괜찮" }, { marker: "스트레스 받으시나요", stem: "스트레스" },
    { marker: "부담되시나요", stem: "부담" }, { marker: "부담스러우신가요", stem: "부담" },
    { marker: "걱정되시나요", stem: "걱정" }, { marker: "걱정되시겠네요", stem: "걱정" },
    { marker: "지치셨나요", stem: "지치" }, { marker: "지치시나요", stem: "지치" },
    { marker: "지치셨겠네요", stem: "지치" }, { marker: "외로우시겠네요", stem: "외로" },
    { marker: "때문에", stem: "때문에" }, { marker: "탓에", stem: "탓에" },
    { marker: "로 인해", stem: "로 인해" }, { marker: "인해서", stem: "인해서" },
    { marker: "싶으신가요", stem: "싶" }, { marker: "싶나요", stem: "싶" },
    { marker: "싶으세요", stem: "싶" }, { marker: "하고 싶", stem: "싶" },
  ],
  // Multilingual Gate — Japanese presumption markers, same concept
  // classes as Korean (tough/hard, anxious, worried, tired, okay?,
  // stress, burden, lonely; causal attribution; must->want reframe),
  // not a literal translation of the Korean list.
  ja: [
    { marker: "おつらいですか", stem: "つら" }, { marker: "つらいですか", stem: "つら" },
    { marker: "しんどいですか", stem: "しんど" },
    { marker: "不安ですか", stem: "不安" }, { marker: "不安でしょうか", stem: "不安" },
    { marker: "心配ですか", stem: "心配" }, { marker: "心配でしょうか", stem: "心配" },
    { marker: "お疲れですか", stem: "疲れ" }, { marker: "疲れましたか", stem: "疲れ" },
    { marker: "大丈夫ですか", stem: "大丈夫" },
    { marker: "ストレスですか", stem: "ストレス" }, { marker: "ストレスでしょうか", stem: "ストレス" },
    { marker: "負担ですか", stem: "負担" }, { marker: "負担でしょうか", stem: "負担" },
    { marker: "寂しいですか", stem: "寂し" }, { marker: "さみしいですか", stem: "さみし" },
    { marker: "落ち込んでいますか", stem: "落ち込" },
    { marker: "のせいで", stem: "せいで" }, { marker: "によって", stem: "によって" },
    { marker: "したいですか", stem: "たい" }, { marker: "したいのですか", stem: "たい" },
  ],
  // Multilingual Gate — English, same concept classes as ko/ja (tough/
  // hard, anxious, worried, tired, okay?, stress, burden, lonely;
  // causal attribution; must->want reframe). Matched case-insensitively
  // (see findUngroundedPresumption below) — stored lowercase.
  en: [
    { marker: "must be hard", stem: "hard" }, { marker: "must be tough", stem: "tough" },
    { marker: "sounds hard", stem: "hard" },
    { marker: "must be anxious", stem: "anxious" }, { marker: "are you anxious", stem: "anxious" },
    { marker: "must be worried", stem: "worried" }, { marker: "are you worried", stem: "worried" },
    { marker: "must be tired", stem: "tired" }, { marker: "are you tired", stem: "tired" },
    { marker: "are you okay", stem: "okay" },
    { marker: "must be stressed", stem: "stressed" }, { marker: "are you stressed", stem: "stressed" },
    { marker: "sounds like a burden", stem: "burden" },
    { marker: "must be lonely", stem: "lonely" }, { marker: "are you lonely", stem: "lonely" },
    { marker: "because of", stem: "because of" }, { marker: "due to", stem: "due to" },
    { marker: "do you want to", stem: "want to" },
  ],
  // 7-Locale Runtime Output Support Gate — same concept classes as
  // ko/ja/en (tough/hard, anxious, worried, tired, okay?, stress,
  // burden, lonely; causal attribution; must->want reframe), not
  // empirically tuned yet (same disclosed status as ja/en's own lists).
  fr: [
    { marker: "ça doit être dur", stem: "dur" }, { marker: "ça a l'air difficile", stem: "difficile" },
    { marker: "êtes-vous anxieux", stem: "anxieux" }, { marker: "ça doit être angoissant", stem: "angoissant" },
    { marker: "êtes-vous inquiet", stem: "inquiet" }, { marker: "ça doit inquiéter", stem: "inquiet" },
    { marker: "vous devez être fatigué", stem: "fatigué" }, { marker: "êtes-vous fatigué", stem: "fatigué" },
    { marker: "ça va", stem: "ça va" },
    { marker: "êtes-vous stressé", stem: "stressé" }, { marker: "ça doit être stressant", stem: "stressant" },
    { marker: "ça a l'air lourd à porter", stem: "lourd" },
    { marker: "vous devez vous sentir seul", stem: "seul" }, { marker: "êtes-vous seul", stem: "seul" },
    { marker: "à cause de", stem: "à cause de" }, { marker: "en raison de", stem: "en raison de" },
    { marker: "voulez-vous", stem: "voulez" },
  ],
  "zh-CN": [
    { marker: "一定很辛苦吧", stem: "辛苦" }, { marker: "是不是很辛苦", stem: "辛苦" },
    { marker: "会不会不安", stem: "不安" }, { marker: "一定很不安吧", stem: "不安" },
    { marker: "会担心吗", stem: "担心" }, { marker: "一定很担心吧", stem: "担心" },
    { marker: "累了吧", stem: "累" }, { marker: "是不是累了", stem: "累" },
    { marker: "还好吗", stem: "还好" },
    { marker: "有压力吗", stem: "压力" }, { marker: "一定很有压力吧", stem: "压力" },
    { marker: "听起来是个负担", stem: "负担" },
    { marker: "会不会孤单", stem: "孤单" }, { marker: "一定很孤单吧", stem: "孤单" },
    { marker: "因为", stem: "因为" }, { marker: "由于", stem: "由于" },
    { marker: "想要吗", stem: "想要" },
  ],
  "zh-HK": [
    { marker: "一定好辛苦嘅", stem: "辛苦" }, { marker: "係咪好辛苦", stem: "辛苦" },
    { marker: "會唔會唔安", stem: "唔安" }, { marker: "一定好唔安嘅", stem: "唔安" },
    { marker: "會擔心咩", stem: "擔心" }, { marker: "一定好擔心嘅", stem: "擔心" },
    { marker: "攰喇喎", stem: "攰" }, { marker: "係咪攰咗", stem: "攰" },
    { marker: "仲好嗎", stem: "好嗎" },
    { marker: "有壓力咩", stem: "壓力" }, { marker: "一定好有壓力嘅", stem: "壓力" },
    { marker: "聽落係個負擔", stem: "負擔" },
    { marker: "會唔會孤單", stem: "孤單" }, { marker: "一定好孤單嘅", stem: "孤單" },
    { marker: "因為", stem: "因為" }, { marker: "由於", stem: "由於" },
    { marker: "想唔想", stem: "想" },
  ],
  "zh-TW": [
    { marker: "一定很辛苦吧", stem: "辛苦" }, { marker: "是不是很辛苦", stem: "辛苦" },
    { marker: "會不會不安", stem: "不安" }, { marker: "一定很不安吧", stem: "不安" },
    { marker: "會擔心嗎", stem: "擔心" }, { marker: "一定很擔心吧", stem: "擔心" },
    { marker: "累了吧", stem: "累" }, { marker: "是不是累了", stem: "累" },
    { marker: "還好嗎", stem: "還好" },
    { marker: "有壓力嗎", stem: "壓力" }, { marker: "一定很有壓力吧", stem: "壓力" },
    { marker: "聽起來是個負擔", stem: "負擔" },
    { marker: "會不會孤單", stem: "孤單" }, { marker: "一定很孤單吧", stem: "孤單" },
    { marker: "因為", stem: "因為" }, { marker: "由於", stem: "由於" },
    { marker: "想要嗎", stem: "想要" },
  ],
};

/** English is matched case-insensitively (markers/stems stored
 *  lowercase) — the model's own casing can vary in a way Korean/
 *  Japanese output does not; ko/ja stay exactly as before this Gate. */
function findUngroundedPresumption(text: string, ground: string, locale: Locale): string | null {
  const cmpText = locale === "en" || locale === "fr" ? text.toLowerCase() : text;
  const cmpGround = locale === "en" || locale === "fr" ? ground.toLowerCase() : ground;
  for (const { marker, stem } of PRESUMPTION_MARKERS[locale]) {
    const idx = cmpText.indexOf(marker);
    if (idx === -1) continue;
    if (cmpGround.includes(stem)) continue;
    // KO Validation Reliability Gate — this stem:"싶"(want) marker list
    // was written for the POSITIVE case only (asserting a new desire
    // the user never stated, e.g. "해야 한다"(must) -> "싶다"(want) — the
    // real amplification §1.B bans). It never accounted for the marker
    // also matching its own NEGATION ("~하고 싶지 않다" = "don't want
    // to"), which is a different polarity meaning the same thing as
    // "싫다"(dislike/don't want to) — the word grounding commonly uses
    // for that exact state (e.g. "하기싫다"). Scoped narrowly to
    // stem === "싶" and only when the marker is immediately followed by
    // a negation in the response, so the original positive-desire
    // restraint check is completely unchanged otherwise.
    if (locale === "ko" && stem === "싶" && /^지\s*(가|는)?\s*(않|없)/.test(cmpText.slice(idx + marker.length))) {
      if (cmpGround.includes("싫")) continue;
    }
    return marker;
  }
  return null;
}

/** Multilingual Gate — Japanese uses Hiragana/Katakana/Kanji, none of
 *  which are Hangul; a Korean-only Hangul-presence check would reject
 *  every valid Japanese response outright (Beta Handoff §4's explicit
 *  warning). Checks the appropriate Japanese script ranges instead.
 *  English requires meaningful Latin-script content (Beta Handoff §9),
 *  not merely "no Hangul" — at least one real word (2+ letters), which
 *  also rejects an empty/punctuation-only response the generic empty
 *  check below wouldn't catch on its own (e.g. a lone question mark). */
const JA_SCRIPT_RE = /[぀-ゟ゠-ヿ一-鿿]/;
const EN_WORD_RE = /[A-Za-z]{2,}/;
/** 7-Locale Runtime Output Support Gate — see finalExperiencePhraser.ts's
 *  identical constants/reasoning for FR_WORD_RE/ZH_SCRIPT_RE/the
 *  Simplified-vs-Traditional disclosed limitation. */
const FR_WORD_RE = /[A-Za-zÀ-ÿ]{2,}/;
const ZH_SCRIPT_RE = /[一-鿿]/;
function hasRequiredScript(text: string, locale: Locale): boolean {
  if (locale === "ja") return JA_SCRIPT_RE.test(text);
  if (locale === "en") return EN_WORD_RE.test(text);
  if (locale === "fr") return FR_WORD_RE.test(text);
  if (locale === "zh-CN" || locale === "zh-HK" || locale === "zh-TW") return ZH_SCRIPT_RE.test(text);
  return /[가-힣]/.test(text);
}
// Kana-only (no Han/Kanji) — used for zh-* below, since Han overlaps
// with Chinese's own native script; see finalExperiencePhraser.ts's
// identical reasoning.
const JA_KANA_ONLY_RE = /[぀-ゟ゠-ヿ]/;
/** Locale-specific cross-language leakage the OTHER locales' checks
 *  cannot see (Hangul/Hiragana-Katakana-Kanji/Latin scripts don't
 *  overlap, so none of these ever fire on genuine same-locale text).
 *  Korean's own check is unchanged/unextended — see
 *  validatePhrasedResponse below, Beta Handoff §5: preserve "ko"
 *  behavior exactly. */
function findUnwantedScriptLeakage(text: string, locale: Locale): string | null {
  if (locale === "ja" && /[가-힣]/.test(text)) return "Hangul";
  if (locale === "en" || locale === "fr") {
    if (/[가-힣]/.test(text)) return "Hangul";
    if (JA_SCRIPT_RE.test(text)) return "Japanese";
  }
  if (locale === "zh-CN" || locale === "zh-HK" || locale === "zh-TW") {
    if (/[가-힣]/.test(text)) return "Hangul";
    if (JA_KANA_ONLY_RE.test(text)) return "Japanese";
  }
  return null;
}

export function validatePhrasedResponse(text: string, decision: ResponseDecision, locale: Locale): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > MAX_LEN[locale]) return { ok: false, reason: `too long (${trimmed.length} chars)` };
  if (!hasRequiredScript(trimmed, locale)) {
    const reason =
      locale === "ja" ? "contains no Japanese script (Hiragana/Katakana/Kanji)"
      : locale === "en" ? "contains no meaningful English text"
      : locale === "fr" ? "contains no meaningful French text"
      : locale === "zh-CN" || locale === "zh-HK" || locale === "zh-TW" ? "contains no Chinese characters"
      : "contains no Hangul";
    return { ok: false, reason };
  }
  // Korean/Japanese/Chinese: any Latin-script word is a language-
  // contract violation (existing "ko"/"ja" behavior, unchanged; zh-*
  // joins them). English/French: this check would reject every valid
  // response, so it is skipped for them — findUnwantedScriptLeakage
  // above is their guard instead, against Hangul/Japanese/Chinese script.
  if (locale !== "en" && locale !== "fr" && /[A-Za-z]{3,}/.test(trimmed)) return { ok: false, reason: "contains an English word — language contract violation" };
  const leakage = findUnwantedScriptLeakage(trimmed, locale);
  if (leakage) return { ok: false, reason: `contains ${leakage} characters — language contract violation` };
  const bannedOpenerCmp = locale === "en" || locale === "fr" ? trimmed.toLowerCase() : trimmed;
  const bannedOpeners = locale === "en" || locale === "fr" ? BANNED_OPENERS[locale].map((o) => o.toLowerCase()) : BANNED_OPENERS[locale];
  if (bannedOpeners.some((o) => bannedOpenerCmp.startsWith(o))) return { ok: false, reason: "fell back to a banned fixed opener" };

  if (decision.mode === "ask") {
    if (!/[?？]$/.test(trimmed)) return { ok: false, reason: "mode=ask but does not end in a question mark" };
  }

  // §2/§1.C — the two banned patterns, checked for EVERY mode including
  // ask now (Conversation Question Quality Gate — previously skipped
  // for ask since that mode was unreachable; now that decideResponse
  // actually constructs it, a real question asking the user to confirm
  // HRI's own guess or explain a relationship is exactly the old
  // banned failure mode reappearing in a new branch, so it stays
  // banned unconditionally, not just for acknowledge*).
  const markerCmp = locale === "en" || locale === "fr" ? trimmed.toLowerCase() : trimmed;
  const hypothesisHit = HYPOTHESIS_CONFIRM_MARKERS[locale].find((m) => markerCmp.includes(m));
  if (hypothesisHit) return { ok: false, reason: `banned hypothesis-confirmation pattern "${hypothesisHit}" — HRI must not assert its own guess and ask for confirmation` };
  const relationHit = RELATION_ANALYSIS_MARKERS[locale].find((m) => markerCmp.includes(m));
  if (relationHit) return { ok: false, reason: `banned relation-analysis-request pattern "${relationHit}" — HRI must not ask the user to analyze a relationship` };

  const ground = groundingText(decision);
  const presumptionHit = findUngroundedPresumption(trimmed, ground, locale);
  if (presumptionHit) {
    return { ok: false, reason: `Restraint violation: ungrounded feeling/cause/desire-reframe marker "${presumptionHit}"` };
  }

  // English/French tokens are lowercased before comparison — sentence-
  // initial capitalization would otherwise make e.g. "Autumn" and
  // "autumn" count as unrelated tokens and risk a spurious rejection;
  // Korean/Japanese/Chinese have no case distinction, so this is a
  // no-op for them.
  const groundingTokens = new Set<string>();
  for (const t of tokenSet(locale === "en" || locale === "fr" ? ground.toLowerCase() : ground)) groundingTokens.add(t);
  const responseTokens = tokenSet(locale === "en" || locale === "fr" ? trimmed.toLowerCase() : trimmed);
  const overlap = [...responseTokens].filter((t) => groundingTokens.has(t)).length;
  // KO Response Validation Fix — ja/en keep the exact-match-only check
  // (overlap > 0) unchanged; ko additionally accepts a stem-level match
  // so a natural Korean paraphrase isn't rejected as "invented" just
  // because its particles/endings differ from the grounding's.
  const hasOverlap = locale === "ko"
    ? overlap > 0 || hasKoreanStemOverlap(responseTokens, groundingTokens)
    : overlap > 0;
  if (responseTokens.size >= 3 && !hasOverlap) {
    return { ok: false, reason: "shares no content with its own grounding — possible invented content" };
  }

  return { ok: true };
}

export async function phraseResponse(
  decision: ResponseDecision,
  locale: Locale,
  externalStats?: ResponseCallStat[],
): Promise<{ text: string | null; outcome: ResponseCallOutcome; errorMessage?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    externalStats?.push({ turn: decision.turn, outcome: "SKIPPED", latencyMs: 0, errorMessage: "OPENAI_API_KEY not set" });
    return { text: null, outcome: "SKIPPED", errorMessage: "OPENAI_API_KEY not set" };
  }

  const start = Date.now();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT[locale] },
          { role: "user", content: buildUserPrompt(decision, locale) },
        ],
        temperature: 0.4,
      }),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      externalStats?.push({ turn: decision.turn, outcome: "TECHNICAL_FAILURE", latencyMs, errorMessage: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` });
      return { text: null, outcome: "TECHNICAL_FAILURE", errorMessage: `HTTP ${res.status}` };
    }
    const body = await res.json().catch(() => undefined);
    const content: string | undefined = body?.choices?.[0]?.message?.content;
    if (!content) {
      externalStats?.push({ turn: decision.turn, outcome: "TECHNICAL_FAILURE", latencyMs, errorMessage: "no content" });
      return { text: null, outcome: "TECHNICAL_FAILURE", errorMessage: "no content in provider response" };
    }
    const validation = validatePhrasedResponse(content, decision, locale);
    if (!validation.ok) {
      externalStats?.push({ turn: decision.turn, outcome: "VALIDATION_FAILURE", latencyMs, errorMessage: validation.reason });
      return { text: null, outcome: "VALIDATION_FAILURE", errorMessage: validation.reason };
    }
    externalStats?.push({ turn: decision.turn, outcome: "SUCCESS", latencyMs });
    return { text: content.trim().replace(/^["']|["']$/g, ""), outcome: "SUCCESS" };
  } catch (err) {
    externalStats?.push({ turn: decision.turn, outcome: "TECHNICAL_FAILURE", latencyMs: Date.now() - start, errorMessage: String(err) });
    return { text: null, outcome: "TECHNICAL_FAILURE", errorMessage: String(err) };
  }
}
