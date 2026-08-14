/**
 * HRI Discovery Routing Engine v1
 * 사용자의 최신 답변에서 신호를 읽어 다음 레이어를 결정한다.
 * 라우팅만 한다. 진단/해석/판단 없음. 어휘 마커 기반 형식 감지.
 */
import { devLog } from "../devLog";

export type DiscoveryDepth = 'D0' | 'D1' | 'D2' | 'D3' | 'D4';

export type DiscoverySignal =
  | 'DESCRIPTION_ONLY'
  | 'STRUCTURE_SURFACED'
  | 'MOVEMENT_SURFACED'
  | 'RHYTHM_SURFACED'
  | 'RECOGNITION'
  | 'CORRECTION';

export type NextLayer =
  | 'ASK_STRUCTURE'
  | 'ASK_DYNAMIC'
  | 'ASK_RHYTHM'
  | 'MIRROR'
  | 'OBSERVATION';

export interface RoutingInput {
  answer: string;
  previousLayer?: NextLayer;
}

export interface RoutingResult {
  depth: DiscoveryDepth;
  signal: DiscoverySignal;
  nextLayer: NextLayer;
}

const POSITIVE_MARKERS = [
  '뿌듯',
  '기쁘',
  '즐겁',
  '행복',
  '만족',
  '완료',
  '마무리',
  '성공',
  '달성',
  '해냈',
  '끝냈',
  '잘됐다',

  '잘 되어',
  '잘되고',
  '잘 진행',
  '순조',
  '완벽',
  '준비가 잘',
  '런칭',
  '서비스 준비',
  '좋아지고',
  '나아지고',
  '괜찮',
  '안정'
];

const CORRECTION_MARKERS = [
  '아니다',
  '아니야',
  '아닌데',
  '아니고',
  '반대',
  '오히려',
  '틀렸다',
  '그게 아니다',
  '잘못',
  '착각'
];

const RECOGNITION_MARKERS: readonly string[] = [
  '아 ', '아,', '아!', '아 그', '그러네', '그렇네', '그러고 보니', '그렇구나',
  '맞아', '맞네', '몰랐', '처음 보', '처음 알', '이제 보', '이제 알',
  '알겠', '깨달', '보이네', '보이기 시작',
];


const MEMORY_MARKERS: readonly string[] = [
  '추억',
  '기억',
  '예전',
  '옛',
  '옛날',
  '그때',
  '과거',
  '첫사랑',
  '친구',
  '고향',
  '학창시절',
  '그 시절'
];
const RHYTHM_MARKERS: readonly string[] = [
  '자꾸', '매번', '반복', '되풀이', '주기', '간격', '때마다', '번번이',
  '왕복', '리듬', '박자', '분기마다', '주마다', '매달', '매주', '주기적',
];

const MOVEMENT_MARKERS: readonly string[] = [
  '늘어', '줄어', '커지', '작아지', '사라지', '돌아오', '되돌아', '올라오',
  '내려가', '번지', '짙어', '옅어', '자라', '빠지', '차오', '움직', '변하',
  '바뀌', '흘러', '밀려',
];

const STRUCTURE_MARKERS: readonly string[] = [
  '아니라', '사실', '에서 오', '때문', '구조', '근본', '밑바닥', '깔린',
  '바탕', '핵심', '결국', '진짜 문제', '진짜는',
];

function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

function containsAny(text: string, markers: readonly string[]): boolean {
  for (const m of markers) {
    if (text.includes(m)) return true;
  }
  return false;
}

export function detectSignal(answer: string): DiscoverySignal {
  const text = normalize(answer ?? '');
  if (
  CORRECTION_MARKERS.some(marker =>
    text.includes(marker)
  )
) {
  return 'CORRECTION';
}
  if (text.trim().length === 0) return 'DESCRIPTION_ONLY';

  if (containsAny(text, POSITIVE_MARKERS)) return 'RECOGNITION';
   if (containsAny(text, MEMORY_MARKERS))
  return 'MOVEMENT_SURFACED';
  if (containsAny(text, RECOGNITION_MARKERS)) return 'RECOGNITION';
  if (containsAny(text, RHYTHM_MARKERS)) return 'RHYTHM_SURFACED';
  if (containsAny(text, MOVEMENT_MARKERS)) return 'MOVEMENT_SURFACED';
  if (containsAny(text, STRUCTURE_MARKERS)) return 'STRUCTURE_SURFACED';
  return 'DESCRIPTION_ONLY';
}

export function signalToDepth(signal: DiscoverySignal): DiscoveryDepth {
  switch (signal) {
    case 'CORRECTION':
      return 'D1';
    case 'RECOGNITION':
      return 'D4';
    case 'RHYTHM_SURFACED':
      return 'D3';
    case 'MOVEMENT_SURFACED':
      return 'D2';
    case 'STRUCTURE_SURFACED':
      return 'D1';
    case 'DESCRIPTION_ONLY':
    default:
      return 'D0';
  }
}

const ASK_LAYERS: ReadonlySet<NextLayer> = new Set<NextLayer>([
  'ASK_STRUCTURE',
  'ASK_DYNAMIC',
  'ASK_RHYTHM',
]);

export function determineNextLayer(
  depth: DiscoveryDepth,
  previousLayer?: NextLayer,
): NextLayer {
  switch (depth) {
    case 'D0':
      if (previousLayer && ASK_LAYERS.has(previousLayer)) return previousLayer;
      return 'ASK_STRUCTURE';
    case 'D1':
      return 'ASK_DYNAMIC';
    case 'D2':
      return 'ASK_RHYTHM';
    case 'D3':
      return 'MIRROR';
    case 'D4':
      return previousLayer === 'MIRROR' ? 'OBSERVATION' : 'MIRROR';
    default:
      return 'ASK_STRUCTURE';
  }
}

export function routeDiscovery(input: RoutingInput): RoutingResult {
  const signal = detectSignal(input.answer);
  const depth = signalToDepth(signal);
  devLog(
  'HRI DEBUG',
  input.answer,
  signal,
  depth
);
  if (signal === 'CORRECTION') {

  return {
    depth,
    signal,
    nextLayer: 'ASK_DYNAMIC'
  };

}
  if (signal === 'RECOGNITION') {
    return { depth, signal, nextLayer: 'OBSERVATION' };
  }

  const nextLayer = determineNextLayer(depth, input.previousLayer);
  return { depth, signal, nextLayer };
}

export default routeDiscovery;