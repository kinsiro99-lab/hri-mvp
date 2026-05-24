import type { SafetyResult } from "./types";

const crisisMarkers = [
  "죽고 싶",
  "사라지고 싶",
  "자해",
  "끝내고 싶",
  "살기 싫",
  "suicide",
  "kill myself",
  "self harm",
];

export function checkSafetyBoundary(inputText: string): SafetyResult {
  const text = inputText.toLowerCase();
  const isCrisis = crisisMarkers.some((marker) => text.includes(marker));

  if (!isCrisis) return { safe: true };

  return {
    safe: false,
    message:
      "지금 내용은 조용히 이어가기보다 안전이 먼저인 흐름으로 보여요. 혼자 감당하지 말고, 가까운 사람이나 지역 긴급 지원에 바로 연결해 주세요. 즉각적인 위험이 있다면 현지 응급 번호로 연락해 주세요.",
  };
}
