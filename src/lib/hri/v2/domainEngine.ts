import type {
  Domain,
  DomainDistribution,
  DomainKeywordMap,
  DomainSignal,
  DetectDomains,
} from "./types.v2";
import { DOMAINS } from "./types.v2";

export const DOMAIN_KEYWORDS: DomainKeywordMap = {
  memory: [
    "기억","감정", "남아", "즐거웠", "즐겁", "따뜻", "아쉽", "편안", "웃","추억", "옛날", "예전", "그때", "장면", "사람으로", "그 시절", "즐겁게", "대화했던", "기억들","어릴", "어렸", "과거", "지난",
    "회상", "떠오르", "떠올라", "생각나", "생각이 나", "다시 보", "남아 있",
    "잊", "잊혀", "잊히", "그 시절", "그 시간", "오래전", "한때",
  ],
  relationship: [
    "보고싶","그립","얼굴","만났","함께","대화","엄마", "아빠", "어머니", "아버지", "부모", "가족", "형", "누나", "언니",
    "동생", "친구", "그 사람", "그분", "연인", "애인", "남편", "아내",
    "동료", "선배", "후배", "관계", "사이", "함께", "같이", "곁", "우리",
    "그녀", "그가", "만나", "헤어", "대화", "연락",
  ],
  loss: [
    "잃", "떠나보", "떠났", "보냈", "사라졌", "없어졌", "죽", "돌아가셨",
    "이별", "헤어", "상실", "빈자리", "공허", "그리움", "남겨",
    "끝나버", "더는 없", "이제 없", "두고", "놓쳤", "놓아",
  ],
  work: [
    "일", "업무", "회사", "직장", "프로젝트", "회의", "보고", "마감", "업적",
    "성과", "실적", "개발", "작업", "납기", "거래", "고객", "상사", "팀",
    "출근", "야근", "퇴사", "이직", "커리어", "승진", "평가", "성취",
  ],
  future: [
    "앞으로", "미래", "나중", "다음", "계획", "준비", "예정", "곧", "될까",
    "할까", "어떻게 될", "어찌 될", "방향", "결정", "선택", "갈림", "내일",
    "다가오", "앞날", "장래", "전망", "불확실", "모르겠",
  ],
  hope: [
    "바라", "바람", "원해", "원하", "기대", "희망", "되면 좋", "잘됐으면",
    "잘 됐으면", "이뤄지", "이뤄졌으면", "꿈", "소망", "설레", "기다려",
    "좋아지", "나아지", "가능", "할 수 있을", "될 수 있",
  ],
  fear: [
    "두렵", "무섭", "겁", "불안", "걱정", "초조", "긴장", "떨려", "위험",
    "큰일", "잘못될", "실패할", "망할", "잃을까", "놓칠까", "들킬까",
    "압박", "부담", "감당", "버거", "도망", "피하고",
  ],
  identity: [
    "나는", "내가", "나라는", "내 모습", "스스로", "자신", "정체", "어떤 사람",
    "어떤 존재", "본질", "진짜 나", "내 자리", "가치", "쓸모", "의미 있",
    "자격", "부족한", "한심", "초라", "자존", "나답", "변했", "달라졌",
  ],
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function scoreDomain(text: string, keywords: readonly string[]): { score: number; hits: string[] } {
  const hits: string[] = [];
  for (const kw of keywords) {
    if (text.includes(kw)) hits.push(kw);
  }
  if (hits.length === 0) return { score: 0, hits };
  const score = clamp01(hits.length / (hits.length + 1));
  return { score, hits };
}

export const detectDomains: DetectDomains = (latestAnswer: string): DomainSignal => {
  const text = (latestAnswer ?? "").normalize("NFC").toLowerCase().trim();

  const distribution: DomainDistribution = {};
  const hits: Partial<Record<Domain, string[]>> = {};

  if (text.length === 0) {
    return { distribution, hits };
  }

  for (const domain of DOMAINS) {
    const result = scoreDomain(text, DOMAIN_KEYWORDS[domain]);
    // Relationship 보강
if (domain === "relationship") {
  if (text.includes("보고싶")) result.score += 1.0;
  if (text.includes("그립")) result.score += 1.0;
  if (text.includes("얼굴")) result.score += 0.8;
  if (text.includes("만났")) result.score += 0.8;
  if (text.includes("함께")) result.score += 0.6;
  if (text.includes("대화")) result.score += 0.6;
}
    if (result.score > 0) {
      distribution[domain] = result.score;
      hits[domain] = result.hits;
    }
  }

  return { distribution, hits };
};

export default detectDomains;