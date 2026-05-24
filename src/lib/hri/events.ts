import type { HriEvent, QuestionOutput, ReflectionOutput, WhisperOutput } from "./types";

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createUserInputEvent(text: string): HriEvent {
  return { id: makeId("user"), type: "user_input", text, createdAt: Date.now() };
}

export function createQuestionEvent(question: QuestionOutput): HriEvent {
  return {
    id: makeId("question"),
    type: "question",
    text: question.text,
    questionId: question.id,
    category: question.category,
    createdAt: Date.now(),
  };
}

export function createReflectionEvent(reflection: ReflectionOutput): HriEvent {
  return { id: makeId("reflection"), type: "reflection", text: reflection.text, createdAt: Date.now() };
}

export function createWhisperEvent(whisper: WhisperOutput): HriEvent {
  return {
    id: makeId("whisper"),
    type: "whisper",
    text: whisper.text,
    mode: whisper.mode,
    createdAt: Date.now(),
  };
}

export function createSafetyEvent(text: string): HriEvent {
  return { id: makeId("safety"), type: "safety", text, createdAt: Date.now() };
}

export function getUserInputTexts(events: HriEvent[]): string[] {
  return events.filter((event): event is Extract<HriEvent, { type: "user_input" }> => event.type === "user_input").map((event) => event.text);
}
