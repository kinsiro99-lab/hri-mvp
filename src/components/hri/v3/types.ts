/**
 * HRI V3 · View 계층 타입
 *
 * 이 파일은 Engine을 모른다.
 * controller / questionPlanner / understandingEngine / callEngine 중
 * 무엇도 import하지 않는다.
 * Engine → View 변환은 오직 Adapter에서만 일어난다.
 *
 * ── 데이터 출처 구분 ──────────────────────────────────
 * [E] Engine 출력에서 온다. 값이 없으면 렌더링하지 않는다.
 * [U] 정적 UI 문구. 분석 결과가 아니며 Engine과 무관하다.
 */

/* ── AURINA의 상태 ─────────────────────────────────────
 * [E] Engine의 진행 단계에서 파생된다. 분석 결과가 아니다. */
export type AurinaState =
  | "standby" // 아직 아무것도 남기지 않음
  | "observing" // 관찰이 놓였고 응답을 기다림
  | "resonating" // Engine 처리 중
  | "reflecting"; // 세션 종료

/* ── Observation Timeline ─────────────────────────────
 * mine  [E] 사용자가 남긴 것
 * ask   [E] Engine이 만든 질문
 * focus [E] 그 질문이 겨냥한 지점. Engine이 실제로 제공할 때만 넘긴다.
 *           값이 없으면 아무것도 렌더링되지 않는다. 임의로 만들지 않는다. */
export type TimelineEntry =
  | { kind: "mine"; text: string }
  | { kind: "ask"; text: string; focus?: string };

/* ── AURINA Observation — 전부 독립 Slot ───────────────
 * 모든 필드가 [E]다. Engine이 실제 값을 줄 때만 채운다.
 * 값이 없는 슬롯은 렌더링하지 않는다.
 * 가짜 분석 결과를 생성하지 않는다. */
export type RhythmTrace = {
  /** SVG path의 d 속성 */
  path?: string;
  /** 곡선 아래 마디. 마지막 항목이 강조된다. */
  keys?: string[];
};

export type ObservationData = {
  /** 핵심 관찰 */
  core?: string;
  /** 리듬의 궤적 */
  rhythm?: RhythmTrace;
  /** 드러나는 의미 */
  emergingMeaning?: string;
  /** 리듬이 향하는 곳 */
  whereItLeads?: string;
  /** 확장 슬롯 */
  insight?: string;
};

/* ── Start Here (운영센터) — Data Driven ───────────────
 * [U] 운영자가 작성하는 정적 콘텐츠. Engine 출력이 아니다. */
export type GuideItem = {
  id: string;
  chip: string;
  accent?: boolean;
  title?: string;
  body?: string;
  steps?: string[];
};
