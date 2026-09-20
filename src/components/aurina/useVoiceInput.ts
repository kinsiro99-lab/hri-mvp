import { useState, useEffect, useRef, useCallback } from "react";
import type { UiLocale } from "@/lib/hri/locale";

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
 */
export function useVoiceInput(locale: UiLocale, inputValue: string, onInputChange: (value: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [interimText, setInterimText] = useState("");

  // Mirrors the `inputValue` prop so recognition callbacks (set up once
  // per session, not on every render) always append to the latest
  // confirmed text, never a stale closure over an earlier render.
  const inputValueRef = useRef(inputValue);
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const userStoppedRef = useRef(true);
  const fatalErrorRef = useRef(false);
  const restartCountRef = useRef(0);
  const latestInterimRef = useRef("");

  const appendFinal = useCallback((spoken: string) => {
    const trimmed = spoken.trim();
    if (!trimmed) return;
    const existing = inputValueRef.current;
    const needsSpace = existing.length > 0 && !/\s$/.test(existing);
    const next = existing ? `${existing}${needsSpace ? " " : ""}${trimmed}` : trimmed;
    inputValueRef.current = next;
    onInputChange(next);
  }, [onInputChange]);

  const clearInterim = useCallback(() => {
    latestInterimRef.current = "";
    setInterimText("");
  }, []);

  const stop = useCallback(() => {
    userStoppedRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setStatus("unsupported");
      return;
    }

    userStoppedRef.current = false;
    fatalErrorRef.current = false;
    restartCountRef.current = 0;

    const beginSession = () => {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = SPEECH_LANG_BY_LOCALE[locale];
      // Android correction (STEP V3): requested anyway (harmless where
      // unsupported), but never trusted — the onend restart logic below
      // is what actually carries a long dictation across Android's own
      // per-utterance auto-stop, not this flag.
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const chunk = result?.[0]?.transcript ?? "";
          if (result?.isFinal) {
            appendFinal(chunk);
            restartCountRef.current = 0;
          } else {
            interim += chunk;
          }
        }
        latestInterimRef.current = interim;
        setInterimText(interim);
      };

      recognition.onerror = (event) => {
        // permission denied / not-allowed / fatal error — never
        // auto-restart (STEP V4 §3). Everything else (no-speech,
        // network, aborted) is treated as transient; onend decides.
        if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
          fatalErrorRef.current = true;
          userStoppedRef.current = true;
        }
      };

      recognition.onend = () => {
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

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setStatus("listening");
      } catch {
        setStatus("idle");
      }
    };

    beginSession();
  }, [locale, appendFinal]);

  const toggle = useCallback(() => {
    if (status === "listening") stop();
    else start();
  }, [status, start, stop]);

  // Unmount safety — never leave a live recognition session or its
  // restart loop running after the owning component unmounts (Arrival
  // unmounts the instant the first turn submits; AurinaSpace's shared
  // instance unmounts with the whole space).
  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  return { status, interimText, toggle, clearInterim };
}
