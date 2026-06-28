import type {
  Domain,
  ConfigAxisKey,
  ConvergenceState,
  FlowCandidate,
  FlowNode,
} from "./types.v2";

const PARTICLE_TAILS = [
  "에서는", "에게서", "으로는", "이라고", "라고는", "에서도", "까지도",
  "이라는", "라는", "에서", "에게", "으로", "라고", "이가", "은는", "도는",
  "까지", "부터", "마저", "조차", "처럼", "보다", "만큼", "이고", "이며",
  "은", "는", "이", "가", "을", "를", "에", "의", "도", "와", "과", "로",
  "만", "땜", "께", "야", "랑", "든", "나",
];

const STOPWORDS = new Set<string>([
  "그것", "이것", "저것", "그게", "이게", "저게", "그거", "이거", "저거",
  "정말", "진짜", "그냥", "조금", "약간", "너무", "아주", "매우", "되게",
  "그리고", "그런데", "그래서", "하지만", "그러나", "근데", "또한", "역시",
  "지금", "오늘", "내일", "어제", "요즘", "아직", "이제", "계속",
]);

function stripTail(word: string): string {
  for (const tail of PARTICLE_TAILS) {
    if (word.length > tail.length && word.endsWith(tail)) {
      return word.slice(0, word.length - tail.length);
    }
  }
  return word;
}

export function extractAnswerTokens(answer: string): string[] {
  const cleaned = (answer ?? "").normalize("NFC").trim();
  if (!cleaned) return [];

  const raw = cleaned.split(/[\s,.!?~…"'()[\]{}]+/).filter(Boolean);
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const w of raw) {
    const t = stripTail(w);
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    if (!/[가-힣]/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    tokens.push(t);
  }

  return tokens.sort((a, b) => b.length - a.length);
}

function primaryToken(answer: string): string | null {
  return extractAnswerTokens(answer)[0] ?? null;
}

type Template = string;

const DOMAIN_PHRASE: Record<Domain, string> = {
  memory: "지난 기억",
  relationship: "그 관계",
  loss: "그 빈자리",
  work: "지금의 일",
  future: "앞으로의 일",
  hope: "그 바람",
  fear: "그 두려움",
  identity: "지금의 자기 자신",
};

const AXIS_TEMPLATE: Partial<Record<ConfigAxisKey, Template>> = {
  collapse: "{t} 쪽이 지금 가장 무겁게 가라앉아 있는 듯합니다.",
  pressure: "{t} 쪽에서 지금 가장 강하게 밀려오고 있는 듯합니다.",
  fragmentation: "{t}이(가) 지금 여러 갈래로 흩어져 있는 듯합니다.",
  looping: "{t}이(가) 자꾸 같은 자리로 돌아오고 있는 듯합니다.",
  avoidance: "{t}을(를) 지금은 한 발 비켜 두고 있는 듯합니다.",
  numbness: "{t}에 대한 감각이 지금은 한 겹 멀어져 있는 듯합니다.",
  selfBlame: "{t}을(를) 지금 당신 쪽으로 끌어와 두고 있는 듯합니다.",
  inwardMotion: "{t}이(가) 지금 안쪽으로 향하고 있는 듯합니다.",
  outwardMotion: "{t}이(가) 지금 밖으로 향하고 있는 듯합니다.",
  achievement: "{t}이(가) 지금 하나의 매듭으로 지어진 듯합니다.",
  momentum: "{t}이(가) 지금 다시 움직이기 시작한 듯합니다.",
  expansion: "{t} 쪽이 지금 조금씩 열리고 있는 듯합니다.",
  vitality: "{t}이(가) 지금 다시 또렷하게 살아나고 있는 듯합니다.",
  connection: "{t}와(과)의 연결이 지금 가까이 닿아 있는 듯합니다.",
  relief: "{t}에서 지금 한결 가벼워진 결이 느껴집니다.",
};

export type ObservationResult = {
  text: string;
  domain: Domain | null;
  axis: ConfigAxisKey | null;
  token: string | null;
  usedQuote: boolean;
};

function fill(template: Template, token: string): string {
  return template.replace(/\{t\}/g, token);
}

export function buildMirror(
  domain: Domain | null,
  axis: ConfigAxisKey | null,
  latestAnswer: string,
): ObservationResult {
  const token = primaryToken(latestAnswer);

  if (axis && AXIS_TEMPLATE[axis] && token) {
    return { text: fill(AXIS_TEMPLATE[axis]!, token), domain, axis, token, usedQuote: false };
  }

  if (axis && AXIS_TEMPLATE[axis] && domain) {
    return { text: fill(AXIS_TEMPLATE[axis]!, DOMAIN_PHRASE[domain]), domain, axis, token: null, usedQuote: false };
  }

  const quote = (latestAnswer ?? "").normalize("NFC").trim();
  const phrase = domain ? DOMAIN_PHRASE[domain] : "지금 떠오른 것";
  return {
    text: `방금 "${quote}"라고 하셨고, 그 안에서 ${phrase}이(가) 지금 살아 있는 듯합니다.`,
    domain,
    axis: null,
    token: null,
    usedQuote: true,
  };
}

function flowPhrase(from: FlowNode, to?: FlowNode): string {
  if (!to) return "";
  const a = from.domain ? DOMAIN_PHRASE[from.domain] : "그것";
  const b = to.domain ? DOMAIN_PHRASE[to.domain] : "그다음";
  if (a === b) return "";
  return `${a}에서 ${b}으로 이어지는 결이 보입니다.`;
}

export function buildObservation(
  convergence: ConvergenceState,
  domain: Domain | null,
  axis: ConfigAxisKey | null,
  latestAnswer: string,
  confirmedFlow: FlowCandidate[] = [],
): ObservationResult | null {
  if (!convergence.converged) return null;

  const mirror = buildMirror(domain, axis, latestAnswer);

  const confirmed = confirmedFlow.filter((f) => f.confirmed);
  if (confirmed.length === 0) {
    return mirror;
  }

  const tail = confirmed
    .map((f) => flowPhrase(f.from, f.to[0]))
    .filter(Boolean)
    .join(" 그리고 ");

  return { ...mirror, text: tail ? `${mirror.text} ${tail}` : mirror.text };
}

export default buildObservation;