export type AnswerSlot =
  | "emotion"
  | "person_scene"
  | "memory"
  | "relationship"
  | "unknown";

export type AnswerValidationResult = {
  completed: boolean;
  slot: AnswerSlot;
};

export function validateAnswer(
  lastQuestionText: string,
  userAnswer: string
): AnswerValidationResult {
  const question = lastQuestionText ?? "";
  const answer = userAnswer ?? "";

  const isEmotionQuestion = /감정|느낌|마음/.test(question);
  const isEmotionAnswer =
    /보고싶|그립|그리움|즐겁|기쁘|따뜻|사랑|좋아|아름|후회|미안|외롭|편안|안도|섭섭|아쉽|슬프|뿌듯|행복|만족/.test(answer);

  if (isEmotionQuestion && isEmotionAnswer) {
    return { completed: true, slot: "emotion" };
  }

  const isPersonSceneQuestion = /장면|사람|선명/.test(question);
  const isPersonSceneAnswer =
    /사람|장면|친구|부모|아버지|어머니|엄마|아빠|아이|연인|가족|형|누나|동생|선생|동료|친척/.test(answer);

  if (isPersonSceneQuestion && isPersonSceneAnswer) {
    return { completed: true, slot: "person_scene" };
  }

  const isMemoryQuestion = /기억|생각|떠오르/.test(question);
  const isMemoryAnswer =
    /추억|기억|생각|옛|예전|과거|어릴|그때|장면|사람/.test(answer);

  if (isMemoryQuestion && isMemoryAnswer) {
    return { completed: true, slot: "memory" };
  }

  const isRelationshipQuestion = /관계|사이|누구|사람/.test(question);
  const isRelationshipAnswer =
    /친구|가족|부모|아버지|어머니|엄마|아빠|연인|동료|선생|사람|그 사람/.test(answer);

  if (isRelationshipQuestion && isRelationshipAnswer) {
    return { completed: true, slot: "relationship" };
  }

  return { completed: false, slot: "unknown" };
}