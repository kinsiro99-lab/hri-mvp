export type MeaningEmotion =
  | "애정"
  | "따뜻함"
  | "즐거움"
  | "그리움"
  | "아쉬움"
  | "후회"
  | "외로움"
  | "편안함"
  | "아름다움"
  | null;

export type MeaningSubject =
  | "사람"
  | "장면"
  | "시간"
  | "관계"
  | "일"
  | "미래"
  | null;

export type MeaningTime =
  | "과거"
  | "현재"
  | "미래"
  | null;

export type MeaningIntent =
  | "간직"
  | "확인"
  | "정리"
  | "그리움"
  | "회복"
  | "이동"
  | null;

export type ExtractedMeaning = {
  subject: MeaningSubject;
  emotion: MeaningEmotion;
  time: MeaningTime;
  intent: MeaningIntent;
  keyword: string | null;
};

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function extractMeaning(answer: string): ExtractedMeaning {
  const text = (answer ?? "").trim();

  let subject: MeaningSubject = null;
  let emotion: MeaningEmotion = null;
  let time: MeaningTime = null;
  let intent: MeaningIntent = null;
  let keyword: string | null = null;

  // Subject
  if (
    includesAny(text, [
      "사람",
      "친구",
      "그 사람",
      "아이",
      "가족",
      "부모",
      "선생",
      "동료",
    ])
  ) {
    subject = "사람";
  } else if (
    includesAny(text, [
      "장면",
      "모습",
      "순간",
      "풍경",
      "자리",
      "시절",
      "시간",
      "추억",
      "기억",
    ])
  ) {
    subject = "장면";
  } else if (
    includesAny(text, [
      "시간",
      "시절",
      "때",
      "옛날",
      "과거",
    ])
  ) {
    subject = "시간";
  } else if (
    includesAny(text, [
      "관계",
      "사이",
      "연결",
    ])
  ) {
    subject = "관계";
  }

  // Emotion
  if (includesAny(text, ["사랑", "좋아", "좋아했던", "아끼"])) {
    emotion = "애정";
    keyword = "사랑";
  } else if (includesAny(text, ["따뜻", "온기"])) {
    emotion = "따뜻함";
    keyword = "따뜻함";
  } else if (includesAny(text, ["즐겁", "기쁨", "웃"])) {
    emotion = "즐거움";
    keyword = "즐거움";
  } else if (includesAny(text, ["그립", "보고 싶"])) {
    emotion = "그리움";
    keyword = "그리움";
  } else if (includesAny(text, ["아쉽", "아쉬움"])) {
    emotion = "아쉬움";
    keyword = "아쉬움";
  } else if (includesAny(text, ["후회", "미안"])) {
    emotion = "후회";
    keyword = "후회";
  } else if (includesAny(text, ["외롭", "쓸쓸"])) {
    emotion = "외로움";
    keyword = "외로움";
  } else if (includesAny(text, ["편안", "안도"])) {
    emotion = "편안함";
    keyword = "편안함";
  } else if (includesAny(text, ["아름다움", "아름답"])) {
    emotion = "아름다움";
    keyword = "아름다움";
  }

  // Time
  if (includesAny(text, ["옛", "그때", "시절", "과거", "전에", "예전"])) {
    time = "과거";
  } else if (includesAny(text, ["지금", "현재", "오늘"])) {
    time = "현재";
  } else if (includesAny(text, ["앞으로", "미래", "다음"])) {
    time = "미래";
  }

  // Intent
  if (includesAny(text, ["남아", "간직", "기억", "소중"])) {
    intent = "간직";
  } else if (includesAny(text, ["확인", "알고", "보고 싶"])) {
    intent = "확인";
  } else if (includesAny(text, ["정리", "끝내", "놓아"])) {
    intent = "정리";
  } else if (includesAny(text, ["그립", "보고 싶"])) {
    intent = "그리움";
  } else if (includesAny(text, ["회복", "다시", "살아"])) {
    intent = "회복";
  } else if (includesAny(text, ["앞으로", "가야", "움직"])) {
    intent = "이동";
  }

  return {
    subject,
    emotion,
    time,
    intent,
    keyword,
  };
}