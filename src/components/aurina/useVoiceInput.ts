import { useState, useEffect, useRef, useCallback } from "react";
import type { UiLocale } from "@/lib/hri/locale";
import { isVoiceDebug, vlog, vq } from "./voiceDebug";

// Voice Input Gate (STEP V4, extracted to a shared hook in STEP V8) —
// minimal Web Speech API wiring, originally built for Arrival's
// voiceChip button and now shared by Conversation/continuation too. No
// new npm package: the DOM lib this project ships (tsconfig's "lib":
// ["dom", ...]) does not include the Web Speech API types, so the
// shapes below are declared locally, scoped to this file only (no
// `declare global` — never touches the ambient Window type app-wide).
type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { readonly transcript: string } | undefined;
};
type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionErrorEventLike = { readonly error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  // Diagnostic-only (voiceDebug) — assigned solely when ?voicedebug=1.
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onnomatch?: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Exported — STEP V8's Final Voice Reflection (Reflection.tsx) reuses
// this same BCP-47 map to prefer a matching speechSynthesis voice for
// the current UI locale, so the two Web Speech features agree on what
// "the current locale's language" means instead of each guessing its
// own mapping.
export const SPEECH_LANG_BY_LOCALE: Record<UiLocale, string> = {
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
  fr: "fr-FR",
  "zh-CN": "zh-CN",
  "zh-HK": "zh-HK",
  "zh-TW": "zh-TW",
};

/** A closed cap on same-session auto-restarts with zero real speech in
 *  between (reset to 0 the moment any isFinal result actually arrives)
 *  — bounds Android's per-utterance auto-stop restart loop (STEP V3:
 *  `continuous` has no effect on Android Chrome) without capping a
 *  genuinely long dictation session made of many real utterances. */
const MAX_AUTO_RESTARTS = 3;

export type VoiceStatus = "idle" | "listening" | "unsupported";

// Diagnostic-only (voiceDebug) — per-instance ids and the set of instances
// currently between start() and onend, so a log can show whether two
// recognition instances are ever alive at once. Never read by any
// behavior path.
let debugInstanceSeq = 0;
const debugAliveIds = new Set<number>();

// Voice UX Final Polish (STEP V11) — three-state chip label, shared by
// Arrival/Conversation/continuation so all three read the exact same
// text instead of three independently-drifting copies. Only "idle"
// reuses the caller's own localized copy (`idleLabel`, e.g.
// t.arrival.voiceChip) — listening/produced are new phrases with no
// existing i18n key, so they follow this file's own established
// ko-literal/en-fallback precedent (see VOICE_UNSUPPORTED_NOTICE_KO/EN
// in Arrival.tsx) rather than inventing a new 7-locale content.ts key
// for two short states.
const VOICE_LISTENING_LABEL_KO = "● 듣고 있어요";
const VOICE_LISTENING_LABEL_EN = "● Listening…";
const VOICE_PRODUCED_LABEL_KO = "✓ 입력완료 · +를 누르세요";
const VOICE_PRODUCED_LABEL_EN = "✓ Ready — tap + to continue";

/**
 * Voice Input Gate (STEP V4) — client-only, feature-detected Web
 * Speech wiring. Never assumes a mic exists; never retries past a
 * fatal permission/service error; never restarts after the user's own
 * explicit stop. interim results are surfaced to the caller for
 * display only (see `interimText`) and are never written through
 * `onInputChange` until a chunk is isFinal — the one exception is
 * `onend` itself, where whatever interim text a just-closed session
 * held can never become isFinal from that engine instance and is
 * merged in as plain text rather than silently dropped (STEP V3 §5:
 * preserved, never pretended to be a confirmed engine result).
 *
 * STEP V8 — moved verbatim out of Arrival.tsx (no behavior change) so
 * Conversation/continuation can share the exact same engine instead of
 * a second, independently-drifting copy. Callers that want the
 * production Arrival behavior unchanged only need to swap their
 * import; nothing about feature detection, interim/final handling,
 * stop, interruption merge-in, the Android onend restart correction,
 * fatal-error handling, or the restart cap changed in this move.
 *
 * STEP V11 — `idleLabel` (the caller's own localized base phrase, e.g.
 * t.arrival.voiceChip) is new and purely additive: it does not change
 * any recognition behavior above, only lets this hook compute the
 * three-state `label` string (see hasProducedText below) once instead
 * of each of the three call sites re-deriving it.
 */
export function useVoiceInput(locale: UiLocale, inputValue: string, onInputChange: (value: string) => void, idleLabel: string) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");
  // Voice UX Final Polish (STEP V11) — true only after this hook's own
  // appendFinal has actually committed voice-produced text (never
  // merely from opening the mic). Auto-clears the moment `inputValue`
  // itself goes back to "" — which a normal submit already does
  // (HriSession/AurinaSpace clear it immediately), and so does the
  // user manually clearing the field — both cases where "✓ 입력완료"
  // would otherwise read as stale. No caller needs to remember to
  // reset this explicitly.
  const [hasProducedText, setHasProducedText] = useState(false);
  useEffect(() => {
    if (inputValue === "") setHasProducedText(false);
  }, [inputValue]);

  // Voice Session Stabilization — once the user has explicitly turned
  // voice on (start() below), that intent persists for the rest of the
  // conversation/session — it must never require pressing the button
  // again turn after turn. Distinct from `status`, which still reflects
  // only whether THIS particular utterance is currently listening; a
  // per-utterance stop/end (natural pause, restart-cap, etc.) does not
  // clear this. Only an explicit resetVoiceMode() call (the caller's
  // own signal that a real restart/new session happened) clears it —
  // this hook has no visibility into "restart" itself.
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);

  // Mirrors the `inputValue` prop so recognition callbacks (set up once
  // per session, not on every render) always append to the latest
  // confirmed text, never a stale closure over an earlier render.
  const inputValueRef = useRef(inputValue);
  useEffect(() => {
    inputValueRef.current = inputValue;
    vlog(`inputValue prop -> ${vq(inputValue)}`);
  }, [inputValue]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const userStoppedRef = useRef(true);
  const fatalErrorRef = useRef(false);
  const restartCountRef = useRef(0);
  const latestInterimRef = useRef("");

  // Android Voice Transcript Fix — the last speech chunk THIS recognition
  // session put at the end of the input. Android Chrome delivers one
  // spoken sentence as several progressively longer isFinal results
  // ("명절이" -> "명절이 가까운" -> "명절이 가까운 날이라"), each a new
  // result index; appending every one of them (the old behavior)
  // stacked all the partial copies. A new chunk that merely extends the
  // last one therefore REPLACES it instead of being appended.
  // Session-scoped on purpose: reset for every new recognition instance
  // and on resetVoiceMode, so a new turn/instance is never merged into
  // the previous one's speech.
  const lastCommittedRef = useRef("");
  // Bumped whenever a recognition session is (re)started by the user or
  // discarded by resetVoiceMode. Every callback of an older recognition
  // instance compares its own captured generation against this and does
  // nothing when they differ, so a stale instance's late result/onend
  // (Android delivers results after stop()) can never write into, or
  // restart, the current session.
  const generationRef = useRef(0);

  const appendFinal = useCallback((spoken: string) => {
    vlog(`appendFinal(${vq(spoken)}) inputValueRef=${vq(inputValueRef.current)} lastCommitted=${vq(lastCommittedRef.current)}`);
    const trimmed = spoken.trim();
    if (!trimmed) return;
    const existing = inputValueRef.current;
    const last = lastCommittedRef.current;
    // Only trust lastCommitted while it is still literally the tail of
    // the input — if the user has typed/edited since, it is just text.
    const tailIsLast = last !== "" && existing.endsWith(last);
    let next: string;
    if (tailIsLast && trimmed === last) {
      vlog("  appendFinal -> duplicate of last committed chunk, skipped");
      return;
    }
    if (tailIsLast && trimmed.startsWith(last)) {
      next = existing.slice(0, existing.length - last.length) + trimmed;
      vlog("  appendFinal -> extends last committed chunk, replacing it");
    } else {
      const needsSpace = existing.length > 0 && !/\s$/.test(existing);
      next = existing ? `${existing}${needsSpace ? " " : ""}${trimmed}` : trimmed;
    }
    lastCommittedRef.current = trimmed;
    inputValueRef.current = next;
    vlog(`  appendFinal -> onInputChange(${vq(next)})`);
    onInputChange(next);
    setHasProducedText(true);
  }, [onInputChange]);

  // What the caller should overlay after the input while speech is still
  // interim. If the interim text is just the last committed chunk plus
  // more words, only the new words are shown — the caller's display is
  // `inputValue + interimText`, so showing the whole interim would
  // print the committed part twice. latestInterimRef keeps the FULL
  // interim so onend's merge (appendFinal) still replaces correctly.
  const interimForDisplay = (interim: string): string => {
    const last = lastCommittedRef.current;
    if (last !== "" && inputValueRef.current.endsWith(last) && interim.startsWith(last)) {
      return interim.slice(last.length).trimStart();
    }
    return interim;
  };

  const clearInterim = useCallback(() => {
    vlog(`clearInterim() (typed input while interim showing) latestInterim=${vq(latestInterimRef.current)}`);
    latestInterimRef.current = "";
    setInterimText("");
  }, []);

  const stop = useCallback(() => {
    vlog(`stop() called; recognitionRef=${recognitionRef.current ? "present" : "none"}`);
    userStoppedRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  // Voice Session Stabilization — a real restart must clear BOTH the
  // session-level flag AND actually end whatever utterance happens to
  // be live (status alone takes priority over voiceModeEnabled in the
  // `label` below, so leaving a live session running would still show
  // "listening" after "새로 시작" despite voiceModeEnabled already
  // being false — confirmed live in testing). Reuses the exact same
  // stop() the button itself calls; recognition mechanics untouched.
  const resetVoiceMode = useCallback(() => {
    vlog("resetVoiceMode()");
    // Android Voice Transcript Fix — a restart must also drop everything
    // the live session still holds, and orphan its callbacks: without
    // this, stop()'s late onend would merge that session's leftover
    // interim into the brand-new session's input.
    generationRef.current += 1;
    lastCommittedRef.current = "";
    latestInterimRef.current = "";
    setInterimText("");
    setVoiceModeEnabled(false);
    stop();
    setStatus("idle");
  }, [stop]);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setStatus("unsupported");
      return;
    }

    vlog(`start() called; previous recognitionRef=${recognitionRef.current ? "present" : "none"} alive=[${[...debugAliveIds].join(",")}]`);
    generationRef.current += 1;
    const generation = generationRef.current;
    setVoiceModeEnabled(true);
    userStoppedRef.current = false;
    fatalErrorRef.current = false;
    restartCountRef.current = 0;

    const beginSession = () => {
      const recognition = new SpeechRecognitionCtor();
      const debugId = ++debugInstanceSeq;
      // New recognition instance = new result index space; never merge
      // its first chunk into the previous instance's last one.
      lastCommittedRef.current = "";
      // Result indexes this instance already committed (index -> text):
      // an engine that re-delivers an old result verbatim must not be
      // committed twice.
      const committedByIndex = new Map<number, string>();
      vlog(`#${debugId} instance created (beginSession); alive=[${[...debugAliveIds].join(",")}]`);
      recognition.lang = SPEECH_LANG_BY_LOCALE[locale];
      // Android correction (STEP V3): requested anyway (harmless where
      // unsupported), but never trusted — the onend restart logic below
      // is what actually carries a long dictation across Android's own
      // per-utterance auto-stop, not this flag.
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        if (generation !== generationRef.current) {
          vlog(`#${debugId} onresult ignored (stale instance)`);
          return;
        }
        if (isVoiceDebug()) {
          const parts: string[] = [];
          for (let i = 0; i < event.results.length; i++) {
            const r = event.results[i];
            parts.push(`[${i}]${i < event.resultIndex ? "(old)" : ""} final=${r?.isFinal} ${vq(r?.[0]?.transcript ?? "")}`);
          }
          vlog(`#${debugId} onresult resultIndex=${event.resultIndex} length=${event.results.length} ${parts.join(" | ")}`);
        }
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const chunk = result?.[0]?.transcript ?? "";
          if (result?.isFinal) {
            restartCountRef.current = 0;
            if (committedByIndex.get(i) === chunk) {
              vlog(`#${debugId}   result[${i}] already committed, skipped`);
              continue;
            }
            committedByIndex.set(i, chunk);
            appendFinal(chunk);
          } else {
            interim += chunk;
          }
        }
        latestInterimRef.current = interim;
        const shownInterim = interimForDisplay(interim);
        vlog(`#${debugId}   interim set -> ${vq(interim)} shown=${vq(shownInterim)}`);
        setInterimText(shownInterim);
      };

      recognition.onerror = (event) => {
        vlog(`#${debugId} onerror error=${event.error}`);
        if (generation !== generationRef.current) return;
        // permission denied / not-allowed / fatal error — never
        // auto-restart (STEP V4 §3). Everything else (no-speech,
        // network, aborted) is treated as transient; onend decides.
        if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
          fatalErrorRef.current = true;
          userStoppedRef.current = true;
        }
      };

      recognition.onend = () => {
        debugAliveIds.delete(debugId);
        if (generation !== generationRef.current) {
          vlog(`#${debugId} onend ignored (stale instance)`);
          return;
        }
        vlog(`#${debugId} onend latestInterim=${vq(latestInterimRef.current)} userStopped=${userStoppedRef.current} fatal=${fatalErrorRef.current} restartCount=${restartCountRef.current} alive=[${[...debugAliveIds].join(",")}]`);
        // Interruption Gate (STEP V4 §5) — this session's own leftover
        // interim can never become isFinal now; merge it in as plain
        // text (same as any other appendFinal call — inputValue makes
        // no "confirmed by engine" distinction anywhere downstream) so
        // it is preserved rather than silently discarded, without ever
        // claiming the recognition engine itself confirmed it.
        if (latestInterimRef.current) {
          appendFinal(latestInterimRef.current);
          latestInterimRef.current = "";
        }
        setInterimText("");

        if (userStoppedRef.current || fatalErrorRef.current) {
          setStatus("idle");
          return;
        }

        // Restart Loop Gate (STEP V4 §3) — only while the user has
        // neither stopped nor hit a fatal error, and only up to a
        // bounded number of consecutive empty restarts.
        restartCountRef.current += 1;
        vlog(`#${debugId} auto-restart attempt restartCount=${restartCountRef.current}/${MAX_AUTO_RESTARTS}`);
        if (restartCountRef.current > MAX_AUTO_RESTARTS) {
          userStoppedRef.current = true;
          setStatus("idle");
          return;
        }

        try {
          beginSession();
        } catch {
          setStatus("idle");
        }
      };

      if (isVoiceDebug()) {
        recognition.onstart = () => vlog(`#${debugId} onstart`);
        recognition.onaudiostart = () => vlog(`#${debugId} onaudiostart`);
        recognition.onspeechstart = () => vlog(`#${debugId} onspeechstart`);
        recognition.onspeechend = () => vlog(`#${debugId} onspeechend`);
        recognition.onnomatch = () => vlog(`#${debugId} onnomatch`);
      }

      recognitionRef.current = recognition;
      try {
        vlog(`#${debugId} recognition.start() invoked`);
        recognition.start();
        debugAliveIds.add(debugId);
        setStatus("listening");
      } catch (e) {
        vlog(`#${debugId} recognition.start() threw ${String(e)}`);
        setStatus("idle");
      }
    };

    beginSession();
  }, [locale, appendFinal]);

  const toggle = useCallback(() => {
    vlog(`toggle() status=${status}`);
    if (status === "listening") stop();
    else start();
  }, [status, start, stop]);

  // Unmount safety — never leave a live recognition session or its
  // restart loop running after the owning component unmounts (Arrival
  // unmounts the instant the first turn submits; AurinaSpace's shared
  // instance unmounts with the whole space).
  useEffect(() => {
    return () => {
      vlog("unmount cleanup: stop()");
      userStoppedRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  // Voice UX Final Polish (STEP V11, corrected for Voice Session
  // Stabilization) — listening takes priority over a still-true
  // hasProducedText (continuous mode: the user may already have one
  // final chunk in while still actively speaking the next one), and
  // "unsupported" never shows the produced state at all (nothing was
  // ever recognized). Once voiceModeEnabled is true, the original
  // "○ {idleLabel}" invite never reappears (the whole point of Voice
  // Session Stabilization) — a brief idle gap while the caller's own
  // auto-resume effect is about to call start() again reads as
  // "listening" rather than falsely inviting the user to press the
  // button they already pressed once this session.
  const label =
    status === "listening"
      ? (locale === "ko" ? VOICE_LISTENING_LABEL_KO : VOICE_LISTENING_LABEL_EN)
      : status !== "unsupported" && hasProducedText
        ? (locale === "ko" ? VOICE_PRODUCED_LABEL_KO : VOICE_PRODUCED_LABEL_EN)
        : status !== "unsupported" && voiceModeEnabled
          ? (locale === "ko" ? VOICE_LISTENING_LABEL_KO : VOICE_LISTENING_LABEL_EN)
          : `○ ${idleLabel}`;

  return { status, interimText, toggle, clearInterim, label, voiceModeEnabled, resetVoiceMode };
}

// Voice Session Stabilization — exported so a single hook instance can
// be created once (in AurinaSpace, which outlives every phase
// transition including Arrival -> Conversation) and passed down as an
// ordinary prop to Arrival, instead of Arrival creating its own,
// independent second instance with its own separate voiceModeEnabled
// that could never survive past Arrival's own unmount. See
// AurinaSpace.tsx/Arrival.tsx for the call site.
export type VoiceInputState = ReturnType<typeof useVoiceInput>;
