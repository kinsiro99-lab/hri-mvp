import type { HriAd, AdType } from "./types";

/**
 * HRI Ad Registry V1 — code-defined only, no Neon table and no admin
 * CRUD yet (Ad Structure V1 Gate §9: deliberately deferred until real
 * operational need is confirmed; follow the Notice system's pattern
 * — src/lib/notice/ — then, don't build it now).
 *
 * rc-reality-check is the RC Card previously hardcoded in Arrival.tsx
 * as the RC_AD constant, moved here verbatim (copy unchanged — no new
 * translation was written as part of this move).
 */
const ADS: readonly HriAd[] = [
  {
    id: "rc-reality-check",
    type: "card",
    active: true,
    image: "/assets/ads/rc-hri-ad-1200x675.png",
    // RC Production URL is not finalized yet (RC Promo Gate) — left
    // undefined on purpose. RcAdCard keeps its CTA disabled while this
    // is unset; never invent a placeholder URL here.
    content: {
      ko: {
        title: "사업의 문제,\n먼저 스스로 점검해보세요",
        description:
          "막연한 고민을 몇 줄 입력하면\nRC가 사업 현실의 구조를 보여주고,\n무엇을 더 점검해야 할지 짚어드립니다.",
        ctaLabel: "RC Reality Check 시작하기 →",
        // Approved image-caption standard §3 — "Business Reality Check"
        // is the brand phrase, kept literal/English across every
        // locale (not translated), so it only needs to live once here;
        // the ko-fallback (resolveAdContent) already carries it to
        // every other locale unchanged.
        imageLine2: "Business Reality Check",
      },
      // Multilingual Localization Gate §10 — natural per-locale copy,
      // no RC destination URL yet (still unset above), so CTA stays
      // disabled in every locale exactly as it already was for ko.
      ja: {
        title: "事業の課題を、\nまずは自分自身で見つめてみましょう",
        description:
          "漠然とした悩みを数行入力するだけで、\nRCが事業の現実の構造を見える化し、\n次に何を確認すべきかを示します。",
        ctaLabel: "RC Reality Checkを始める →",
      },
      en: {
        title: "Before anything else,\ntake a look at your business yourself",
        description:
          "Type in a few lines about what's on your mind,\nand RC will map out the structure of your business reality\nand point to what's worth checking next.",
        ctaLabel: "Start RC Reality Check →",
      },
      // French Locale Gate — natural service French, drafted independently
      // (not translated from en). No imageLine2 here, matching every
      // other non-ko locale's own entry above/below (resolveAdContent
      // returns this object as-is, not merged with ko's).
      fr: {
        title: "Avant toute chose,\nregardez votre entreprise par vous-même",
        description:
          "Décrivez en quelques lignes ce qui vous préoccupe,\net RC dressera la structure de la réalité de votre entreprise\net indiquera ce qu'il vaut la peine de vérifier ensuite.",
        ctaLabel: "Démarrer RC Reality Check →",
      },
      "zh-CN": {
        title: "关于经营中的问题，\n先自己检视一下",
        description:
          "只需输入几行你模糊的困扰，\nRC 就会呈现你事业现实的结构，\n并告诉你接下来该检查什么。",
        ctaLabel: "开始 RC Reality Check →",
      },
      "zh-HK": {
        title: "關於營運上的問題，\n先自行檢視一下",
        description:
          "只需輸入幾行您模糊的煩惱，\nRC 便會呈現您事業現實的結構，\n並指出接下來應該檢視什麼。",
        ctaLabel: "開始 RC Reality Check →",
      },
      "zh-TW": {
        title: "關於經營上的課題，\n先自己檢視看看",
        description:
          "只要輸入幾行你模糊的煩惱，\nRC 就會呈現你事業現實的結構，\n並提醒你接下來該檢查什麼。",
        ctaLabel: "開始 RC Reality Check →",
      },
    },
  },
];

export function getAd(id: string): HriAd | undefined {
  return ADS.find((ad) => ad.id === id);
}

export function getActiveAdsByType(type: AdType): HriAd[] {
  return ADS.filter((ad) => ad.active && ad.type === type);
}
