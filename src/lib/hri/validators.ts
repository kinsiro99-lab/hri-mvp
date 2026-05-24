const bannedReflectionPhrases = [
  "괜찮아질 거예요",
  "잘하고 있어요",
  "해결",
  "극복",
  "노력해보세요",
  "휴식이 필요합니다",
  "추천합니다",
  "해야 합니다",
];

const bannedWhisperPhrases = [
  "해야 합니다",
  "추천합니다",
  "목표를 세워보세요",
  "운동하세요",
  "명상하세요",
  "생산성",
  "효율적으로",
  "극복",
];

export function validateReflection(text: string): boolean {
  return !bannedReflectionPhrases.some((phrase) => text.includes(phrase));
}

export function validateWhisper(text: string): boolean {
  return !bannedWhisperPhrases.some((phrase) => text.includes(phrase));
}
