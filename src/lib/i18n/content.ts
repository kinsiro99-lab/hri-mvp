/**
 * Multilingual Gate — shared UI content dictionary. One flat, typed
 * object per locale, consumed directly by components via a `locale`
 * prop threaded down from HriSession.tsx. Deliberately NOT a component
 * tree per locale (Beta Handoff §10: "no duplicated Japanese component
 * tree") — the JSX/markup stays identical, only the strings differ.
 *
 * Only covers strings actually rendered by the current UI. Several
 * computed strings in HriSession.tsx (guideItems, aurinaVoice,
 * NOT_YET_CLEAR, the "Beta Test Closed" branch) and all of Workspace.tsx
 * are unreachable dead code as of this Gate (see the Gate's own final
 * report) and are intentionally NOT covered here.
 *
 * Multilingual Localization Gate — keyed by `UiLocale` (ko/ja/en/
 * zh-CN/zh-HK/zh-TW), not Runtime's narrower `Locale`. This file is
 * UI-only and never imported by Runtime; the zh-CN/zh-HK/zh-TW entries
 * below are independently authored per region (not a mechanical
 * simplified<->traditional conversion of one another) but the actual
 * conversation/Reflection text a Chinese-locale user receives still
 * comes from the en Runtime (see toEngineLocale in ../hri/locale.ts) —
 * a disclosed Beta limitation, not something this file can change.
 */
import type { UiLocale } from "@/lib/hri/locale";

export type Content = {
  localeSwitcher: {
    ko: string;
    ja: string;
    en: string;
    fr: string;
    "zh-CN": string;
    "zh-HK": string;
    "zh-TW": string;
  };
  common: {
    close: string;
  };
  arrival: {
    menuAria: string;
    languageIconAria: string;
    headline: string;
    description: string;
    coreQuestion: string;
    permissionText: string;
    exampleText: string;
    inputPlaceholder: string;
    enterHint: string;
    voiceChip: string;
    anonymousChip: string;
    trustText: string;
    privacyText: string;
    noticeText: string;
    noticeKicker: (date: string) => string;
    historyLink: string;
    finalLink: string;
    restartLink: string;
    adLabel: string;
    adDisclaimer: string;
    adImageLine1: string;
    adOpeningBadge: string;
    cards: {
      mirrorTitle: string;
      mirrorLineHistory: string;
      mirrorLineDefault: string;
      rhythmTitle: string;
      rhythmLineFinal: string;
      rhythmLineDefault: string;
      nextTitle: string;
      nextLineRestart: string;
      nextLineDefault: string;
    };
  };
  benefits: {
    title: string;
    core: string;
    body: string;
    cta: string;
  };
  conversation: {
    home: string;
    viewFinal: string;
    restart: string;
    prevConversationAria: string;
    showMore: (count: number) => string;
    collapse: string;
    myStory: string;
    thinking: string;
    inputPlaceholder: string;
    continuationTitle: string;
    continuationPlaceholder: string;
  };
  reflection: {
    title: string;
    subtitle: string;
    mirrorLabel: string;
    mirrorEmpty: string;
    giftLabel: string;
    giftEmpty: string;
    viewHistory: string;
    home: string;
    restartTalk: string;
  };
  input: {
    textareaAria: string;
    submitAria: string;
  };
  session: {
    networkError: string;
  };
};

const LOCALE_SWITCHER = {
  ko: "한국어",
  ja: "日本語",
  en: "English",
  fr: "Français",
  "zh-CN": "简体中文",
  "zh-HK": "繁體中文（香港）",
  "zh-TW": "繁體中文（台灣）",
};

export const CONTENT: Record<UiLocale, Content> = {
  ko: {
    localeSwitcher: LOCALE_SWITCHER,
    common: { close: "닫기" },
    arrival: {
      menuAria: "메뉴",
      languageIconAria: "언어 선택",
      headline: "마음의 거울",
      description: "당신의 지금을 함께 바라봅니다.",
      coreQuestion: "지금 어떤 이야기가 떠오르나요?",
      permissionText: "작은 일이나 오늘 있었던 일부터 시작해도 됩니다.",
      exampleText: "예: 오늘 일이 잘 안 풀렸다 · 누군가 생각난다 · 그냥 조금 답답하다",
      inputPlaceholder: "지금 떠오르는 것을 적어보세요",
      enterHint: "Enter로 계속하기",
      voiceChip: "음성으로 이야기하기",
      anonymousChip: "익명으로 시작하기",
      trustText: "마음의 거울은 채팅방이 아닙니다.\n당신 자신을 바라보기 위한 마음의 창입니다.",
      privacyText: "HRI에서 나눈 이야기는 외부에 공개되지 않습니다.",
      noticeText: "HRI는 평가나 진단을 위한 도구가 아니며, 현재의 생각과 흐름을 통해\n당신의 리듬을 함께 바라봅니다.",
      noticeKicker: (date) => `공지 · ${date}`,
      historyLink: "이전 대화 이어보기",
      finalLink: "Reflection 다시 보기",
      restartLink: "새로 시작하기",
      adLabel: "HRI 안내 · 관련 서비스",
      adDisclaimer: "RC는 HRI와 독립적으로 운영되는 Business Reality 서비스입니다.",
      adImageLine1: "자가진단부터 시작하는",
      adOpeningBadge: "8월 28일 오픈 예정",
      cards: {
        mirrorTitle: "마음의 거울",
        mirrorLineHistory: "지금까지의 대화를 다시 봅니다.",
        mirrorLineDefault: "지금의 나를 비추어 봅니다.",
        rhythmTitle: "리듬의 이해",
        rhythmLineFinal: "완성된 Final을 다시 봅니다.",
        rhythmLineDefault: "마음의 흐름을 발견합니다.",
        nextTitle: "다음 리듬",
        nextLineRestart: "새로운 대화를 시작합니다.",
        nextLineDefault: "새로운 방향을 함께 찾습니다.",
      },
    },
    benefits: {
      title: "당신에게 도움이 되는 이유 3가지",
      core: "나를 이해 → 다른 사람을 이해 → 함께하는 일을 이해",
      body: "를 위해 활용하세요. 다음 단계의 조직편과 자매 서비스인\n사업·프로젝트·사회활동 등의 자가진단 시스템을 활용하실 수 있게 됩니다.",
      cta: "ID 신청은 그때 가능합니다!",
    },
    conversation: {
      home: "홈",
      viewFinal: "Final 결과 보기",
      restart: "새로 시작",
      prevConversationAria: "이전 대화",
      showMore: (count) => `이전 대화 더보기 (${count})`,
      collapse: "접기",
      myStory: "나의 이야기",
      thinking: "AURINA가 지금까지의 이야기를 천천히 바라보고 있습니다…",
      inputPlaceholder: "지금 떠오르는 것을 적어보세요.",
      continuationTitle: "더 떠오르는 것이 있다면",
      continuationPlaceholder: "이어서 적어보세요.",
    },
    reflection: {
      title: "당신의 마음에 나타난 흐름",
      subtitle: "지금까지의 이야기를 바탕으로 당신의 마음에 나타난 흐름을 살펴보겠습니다.",
      mirrorLabel: "마음의 거울",
      mirrorEmpty: "아직 드러나지 않았습니다.",
      giftLabel: "마음이 머무는 곳",
      giftEmpty: "지금 이 흐름은 아직 완전히 정리된 형태는 아니지만, 있는 그대로도 충분히 의미가 있습니다.",
      viewHistory: "대화 다시 보기",
      home: "홈",
      restartTalk: "다시 대화하기",
    },
    input: {
      textareaAria: "입력창",
      submitAria: "계속하기",
    },
    session: {
      networkError: "잠시 연결이 원활하지 않아요. 다시 시도해 주세요.",
    },
  },
  // Multilingual Gate — Japanese. Natural service Japanese throughout,
  // not dictionary translation; approved service labels (Beta Handoff
  // §3) reused verbatim: 心の鏡 / 心が休まる場所 / 心に現れた流れ. Explicit
  // あなた avoided per §3.
  ja: {
    localeSwitcher: LOCALE_SWITCHER,
    common: { close: "閉じる" },
    arrival: {
      menuAria: "メニュー",
      languageIconAria: "言語選択",
      headline: "心の鏡",
      // Checkpoint Gate — SET A (headline + description) reads as one
      // message: "this is a mirror for your heart" -> "now, look at
      // your heart." SET B (coreQuestion + input) is a separate,
      // second invitation to actually write something down. "心に" was
      // removed from coreQuestion per this Gate's explicit instruction
      // — the question is now exactly "最初に浮かぶことは何ですか？".
      description: "今、あなたの心を見てください。",
      coreQuestion: "今、どんなことが浮かびますか？",
      permissionText: "些細なことや、今日あった出来事から始めても大丈夫です。",
      exampleText: "例：今日はうまくいかなかった・誰かのことを思い出す・なんとなく気が重い",
      inputPlaceholder: "今、浮かんでいることを書いてみてください",
      enterHint: "Enterで続ける",
      voiceChip: "音声で話す",
      anonymousChip: "匿名で始める",
      trustText: "心の鏡はチャットルームではありません。\n自分自身を見つめるための、心の窓です。",
      privacyText: "HRIで話した内容は、外部には公開されません。",
      noticeText: "HRIは評価や診断のためのツールではなく、今の考えや流れを通して心のリズムを共に見つめます。",
      noticeKicker: (date) => `お知らせ · ${date}`,
      historyLink: "前の対話を続ける",
      finalLink: "Reflectionをもう一度見る",
      restartLink: "新しく始める",
      adLabel: "HRIからのご案内 · 関連サービス",
      adDisclaimer: "RCはHRIとは独立して運営されるBusiness Realityサービスです。",
      adImageLine1: "セルフ診断から始める",
      adOpeningBadge: "8月28日オープン予定",
      cards: {
        mirrorTitle: "心の鏡",
        mirrorLineHistory: "これまでの対話を見返します。",
        mirrorLineDefault: "今の自分を映してみます。",
        rhythmTitle: "リズムの理解",
        rhythmLineFinal: "完成したFinalを見返します。",
        rhythmLineDefault: "心の流れを見つけます。",
        nextTitle: "次のリズム",
        nextLineRestart: "新しい対話を始めます。",
        nextLineDefault: "新しい方向を探します。",
      },
    },
    benefits: {
      title: "あなたに役立つ3つの理由",
      core: "自分を理解する → 他者を理解する → ともに取り組むことを理解する",
      body: "のために活用してください。次の段階である組織版・姉妹サービスとして、\nビジネス・プロジェクト・社会活動などのセルフチェックシステムをご利用いただけるようになります。",
      cta: "IDの申請は、その時にご案内します。",
    },
    conversation: {
      home: "ホーム",
      viewFinal: "Final結果を見る",
      restart: "新しく始める",
      prevConversationAria: "これまでの対話",
      showMore: (count) => `これまでの対話をもっと見る (${count})`,
      collapse: "閉じる",
      myStory: "わたしの話",
      thinking: "AURINAがこれまでのお話をゆっくり見つめています…",
      inputPlaceholder: "今、浮かんでいることを書いてみてください。",
      continuationTitle: "もう少し浮かぶことがあれば",
      continuationPlaceholder: "続けて書いてみてください。",
    },
    reflection: {
      title: "心に現れた流れ",
      subtitle: "これまでのお話をもとに、心に現れた流れを見ていきます。",
      mirrorLabel: "心の鏡",
      mirrorEmpty: "まだ現れていません。",
      giftLabel: "心が休まる場所",
      giftEmpty: "今のこの流れはまだ完全に整理された形ではありませんが、そのままでも十分に意味があります。",
      viewHistory: "対話を見返す",
      home: "ホーム",
      restartTalk: "もう一度話す",
    },
    input: {
      textareaAria: "入力欄",
      submitAria: "続ける",
    },
    session: {
      networkError: "少し接続が不安定なようです。もう一度お試しください。",
    },
  },
  // Multilingual Gate — English. Natural English throughout, not a
  // literal translation of Korean; approved service labels (Beta
  // Handoff §5) reused verbatim: Inner Mirror / A Place to Rest / The
  // Flow Emerging Within. Avoids overusing "your heart"/"your inner
  // self"/"your journey" and therapy/counseling clichés per §5.
  en: {
    localeSwitcher: LOCALE_SWITCHER,
    common: { close: "Close" },
    arrival: {
      menuAria: "Menu",
      languageIconAria: "Language",
      headline: "Inner Mirror",
      description: "A quiet look at where things stand right now.",
      coreQuestion: "What's on your mind right now?",
      permissionText: "It's fine to start small — even just how today went.",
      exampleText: "e.g. today didn't go so well · someone's on my mind · just feeling a bit heavy",
      inputPlaceholder: "Write down what's coming up right now",
      enterHint: "Press Enter to continue",
      voiceChip: "Speak instead",
      anonymousChip: "Start anonymously",
      trustText: "Inner Mirror is not a chat room.\nA window for looking at yourself.",
      privacyText: "What you share with HRI is not made public.",
      noticeText: "HRI is not a tool for evaluation or diagnosis — it looks at the rhythm behind your current thoughts and flow, together with you.",
      noticeKicker: (date) => `Notice · ${date}`,
      historyLink: "Continue previous conversation",
      finalLink: "View Reflection again",
      restartLink: "Start over",
      adLabel: "HRI · Related Service",
      adDisclaimer: "RC is a Business Reality service operated independently of HRI.",
      adImageLine1: "Start with Self-Assessment",
      adOpeningBadge: "Opening August 28",
      cards: {
        mirrorTitle: "Inner Mirror",
        mirrorLineHistory: "Look back at the conversation so far.",
        mirrorLineDefault: "See where things stand right now.",
        rhythmTitle: "Understanding the Rhythm",
        rhythmLineFinal: "Revisit your completed Final.",
        rhythmLineDefault: "Find the flow underneath things.",
        nextTitle: "The Next Rhythm",
        nextLineRestart: "Start a new conversation.",
        nextLineDefault: "Look for a new direction.",
      },
    },
    benefits: {
      title: "Three reasons this can help you",
      core: "Understand yourself → Understand others → Understand what you're building together",
      body: "Use it to work through that arc. As the next stage — a companion service for organizations — you'll gain access to a self-assessment system for business, projects, and social initiatives.",
      cta: "ID sign-ups will open at that stage.",
    },
    conversation: {
      home: "Home",
      viewFinal: "View Final result",
      restart: "Start over",
      prevConversationAria: "Earlier conversation",
      showMore: (count) => `Show earlier conversation (${count})`,
      collapse: "Collapse",
      myStory: "What I said",
      thinking: "AURINA is slowly taking in the conversation so far…",
      inputPlaceholder: "Write down what's coming up right now.",
      continuationTitle: "If anything else comes to mind",
      continuationPlaceholder: "Keep writing.",
    },
    reflection: {
      title: "The Flow Emerging Within",
      subtitle: "Based on what you've shared, here's the flow that's emerged.",
      mirrorLabel: "Inner Mirror",
      mirrorEmpty: "Nothing has emerged yet.",
      giftLabel: "A Place to Rest",
      giftEmpty: "This isn't fully settled yet, but it holds enough meaning as it stands.",
      viewHistory: "Revisit the conversation",
      home: "Home",
      restartTalk: "Talk again",
    },
    input: {
      textareaAria: "Input field",
      submitAria: "Continue",
    },
    session: {
      networkError: "The connection seems a little unstable. Please try again.",
    },
  },
  // French Locale Gate — natural, contemporary service French
  // throughout, not a literal translation of en/ko. Three approved
  // brand terms reused verbatim wherever the source locales reuse
  // their own equivalent: "Miroir intérieur" (headline / cards.
  // mirrorTitle / reflection.mirrorLabel), "Ce qui émerge en vous"
  // (reflection.title), "Un lieu où se poser" (reflection.giftLabel).
  // AURINA's actual conversation/Reflection text still runs on the en
  // Runtime for this locale (Runtime has no French SYSTEM_PROMPT/
  // safety support yet) — see toEngineLocale in ../hri/locale.ts. This
  // entry only covers fixed UI/Benefits/Notice/Advertising chrome.
  fr: {
    localeSwitcher: LOCALE_SWITCHER,
    common: { close: "Fermer" },
    arrival: {
      menuAria: "Menu",
      languageIconAria: "Langue",
      headline: "Miroir intérieur",
      description: "Un regard calme sur où vous en êtes, là, maintenant.",
      coreQuestion: "Qu'est-ce qui vous vient à l'esprit, là, maintenant ?",
      permissionText: "Vous pouvez commencer petit — même juste comment s'est passée votre journée.",
      exampleText: "ex. la journée a été difficile · je pense à quelqu'un · je me sens un peu lourd",
      inputPlaceholder: "Écrivez ce qui vous vient à l'esprit, là, maintenant",
      enterHint: "Appuyez sur Entrée pour continuer",
      voiceChip: "Parler à la place",
      anonymousChip: "Commencer anonymement",
      trustText: "Miroir intérieur n'est pas un salon de discussion.\nUne fenêtre pour vous regarder vous-même.",
      privacyText: "Ce que vous partagez avec HRI n'est pas rendu public.",
      noticeText: "HRI n'est pas un outil d'évaluation ou de diagnostic — il observe avec vous le rythme derrière vos pensées et votre état actuel.",
      noticeKicker: (date) => `Avis · ${date}`,
      historyLink: "Continuer la conversation précédente",
      finalLink: "Revoir la Reflection",
      restartLink: "Recommencer",
      adLabel: "HRI · Service partenaire",
      adDisclaimer: "RC est un service Business Reality, exploité indépendamment de HRI.",
      adImageLine1: "Commencez par une auto-évaluation",
      adOpeningBadge: "Ouverture le 28 août",
      cards: {
        mirrorTitle: "Miroir intérieur",
        mirrorLineHistory: "Revoir la conversation jusqu'ici.",
        mirrorLineDefault: "Voir où vous en êtes, là, maintenant.",
        rhythmTitle: "Comprendre le rythme",
        rhythmLineFinal: "Revoir votre Final complété.",
        rhythmLineDefault: "Trouver le mouvement sous les choses.",
        nextTitle: "Le rythme suivant",
        nextLineRestart: "Commencer une nouvelle conversation.",
        nextLineDefault: "Chercher une nouvelle direction.",
      },
    },
    benefits: {
      title: "Trois raisons pour lesquelles cela peut vous aider",
      core: "Se comprendre soi-même → Comprendre les autres → Comprendre ce que vous construisez ensemble",
      body: "Utilisez-le pour parcourir ce cheminement. À l'étape suivante — un service complémentaire pour les organisations — vous aurez accès à un système d'auto-évaluation pour les entreprises, les projets et les initiatives sociales.",
      cta: "Les inscriptions ID ouvriront à cette étape.",
    },
    conversation: {
      home: "Accueil",
      viewFinal: "Voir le résultat Final",
      restart: "Recommencer",
      prevConversationAria: "Conversation précédente",
      showMore: (count) => `Voir la conversation précédente (${count})`,
      collapse: "Réduire",
      myStory: "Ce que j'ai dit",
      thinking: "AURINA prend lentement connaissance de la conversation jusqu'ici…",
      inputPlaceholder: "Écrivez ce qui vous vient à l'esprit, là, maintenant.",
      continuationTitle: "Si autre chose vous vient à l'esprit",
      continuationPlaceholder: "Continuez à écrire.",
    },
    reflection: {
      title: "Ce qui émerge en vous",
      subtitle: "D'après ce que vous avez partagé, voici le mouvement qui a émergé.",
      mirrorLabel: "Miroir intérieur",
      mirrorEmpty: "Rien n'a encore émergé.",
      giftLabel: "Un lieu où se poser",
      giftEmpty: "Ce n'est pas encore tout à fait défini, mais cela porte déjà assez de sens tel quel.",
      viewHistory: "Revoir la conversation",
      home: "Accueil",
      restartTalk: "Parler à nouveau",
    },
    input: {
      textareaAria: "Champ de saisie",
      submitAria: "Continuer",
    },
    session: {
      networkError: "La connexion semble un peu instable. Veuillez réessayer.",
    },
  },
  // Multilingual Localization Gate — Simplified Chinese (Mainland).
  // Natural Mainland web-service register throughout, not a character
  // conversion of zh-HK/zh-TW below (each of the three was drafted
  // independently). AURINA's actual conversation/Reflection text still
  // runs on the en Runtime for this locale (Runtime has no Chinese
  // SYSTEM_PROMPT/safety support yet) — see toEngineLocale in
  // ../hri/locale.ts. This entry only covers fixed UI/Benefits/Notice/
  // Advertising chrome.
  "zh-CN": {
    localeSwitcher: LOCALE_SWITCHER,
    common: { close: "关闭" },
    arrival: {
      menuAria: "菜单",
      languageIconAria: "选择语言",
      headline: "心镜",
      description: "一起看看你此刻的状态。",
      coreQuestion: "现在，你想到了什么？",
      permissionText: "从一件小事，或者今天发生的事开始也可以。",
      exampleText: "例如：今天不太顺利 · 突然想起了某个人 · 就是有点闷",
      inputPlaceholder: "写下此刻浮现的想法",
      enterHint: "按 Enter 继续",
      voiceChip: "用语音说说看",
      anonymousChip: "匿名开始",
      trustText: "心镜不是聊天室。\n它是一扇让你看见自己的心灵之窗。",
      privacyText: "你在 HRI 中分享的内容不会公开。",
      noticeText: "HRI 不是用来评估或诊断的工具，而是透过你当下的想法与状态，\n一起看见你的节奏。",
      noticeKicker: (date) => `公告 · ${date}`,
      historyLink: "继续之前的对话",
      finalLink: "再看一次 Reflection",
      restartLink: "重新开始",
      adLabel: "HRI 推荐 · 相关服务",
      adDisclaimer: "RC 是与 HRI 独立运营的 Business Reality 服务。",
      adImageLine1: "从自我诊断开始",
      adOpeningBadge: "8月28日 即将开放",
      cards: {
        mirrorTitle: "心镜",
        mirrorLineHistory: "回看至今为止的对话。",
        mirrorLineDefault: "照见此刻的自己。",
        rhythmTitle: "理解节奏",
        rhythmLineFinal: "再看一次已完成的 Final。",
        rhythmLineDefault: "发现内心的流动。",
        nextTitle: "下一段节奏",
        nextLineRestart: "开始新的对话。",
        nextLineDefault: "一起寻找新的方向。",
      },
    },
    benefits: {
      title: "对你有帮助的三个理由",
      core: "理解自己 → 理解他人 → 理解共同的事业",
      body: "可以用它来梳理这个过程。作为下一阶段面向组织的姊妹服务，\n你将能够使用面向商业、项目、社会活动等场景的自我诊断系统。",
      cta: "届时才开放 ID 申请。",
    },
    conversation: {
      home: "首页",
      viewFinal: "查看 Final 结果",
      restart: "重新开始",
      prevConversationAria: "之前的对话",
      showMore: (count) => `查看更多之前的对话 (${count})`,
      collapse: "收起",
      myStory: "我说的话",
      thinking: "AURINA 正在慢慢梳理你到目前为止说的话……",
      inputPlaceholder: "写下此刻浮现的想法。",
      continuationTitle: "如果还有其他想法",
      continuationPlaceholder: "请继续写下去。",
    },
    reflection: {
      title: "浮现在你心中的流动",
      subtitle: "根据到目前为止的对话，我们来看看浮现在你心中的流动。",
      mirrorLabel: "心镜",
      mirrorEmpty: "还没有浮现出来。",
      giftLabel: "心安放的地方",
      giftEmpty: "这段流动现在还没有完全成形，但即使如此，它本身也已经足够有意义。",
      viewHistory: "重新查看对话",
      home: "首页",
      restartTalk: "再聊一次",
    },
    input: {
      textareaAria: "输入框",
      submitAria: "继续",
    },
    session: {
      networkError: "网络连接暂时不太稳定，请重试一次。",
    },
  },
  // Multilingual Localization Gate — Traditional Chinese (Hong Kong).
  // Drafted independently from zh-CN/zh-TW, not converted from either
  // — vocabulary choices (e.g. 網絡/檢視/機構) follow Hong Kong written
  // usage, not Mainland or Taiwan norms. See zh-CN's note above re:
  // Runtime scope (fixed UI/Benefits/Notice/Advertising chrome only).
  "zh-HK": {
    localeSwitcher: LOCALE_SWITCHER,
    common: { close: "關閉" },
    arrival: {
      menuAria: "選單",
      languageIconAria: "選擇語言",
      headline: "心之鏡",
      description: "一起看看您此刻的狀態。",
      coreQuestion: "現在，您想起了什麼？",
      permissionText: "由一件小事，或者今天發生的事開始也可以。",
      exampleText: "例如：今日不太順利 · 突然想起某個人 · 只是有點鬱悶",
      inputPlaceholder: "寫下此刻浮現的想法",
      enterHint: "按 Enter 繼續",
      voiceChip: "用語音講講看",
      anonymousChip: "匿名開始",
      trustText: "心之鏡不是聊天室，\n而是讓您看見自己的一扇心窗。",
      privacyText: "您在 HRI 分享的內容不會對外公開。",
      noticeText: "HRI 並非評估或診斷的工具，而是透過您此刻的想法與狀態，\n一起看見您的節奏。",
      noticeKicker: (date) => `公告 · ${date}`,
      historyLink: "繼續之前的對話",
      finalLink: "重新查看 Reflection",
      restartLink: "重新開始",
      adLabel: "HRI 推薦 · 相關服務",
      adDisclaimer: "RC 是與 HRI 獨立運營的 Business Reality 服務。",
      adImageLine1: "由自我檢視開始",
      adOpeningBadge: "8月28日 即將開放",
      cards: {
        mirrorTitle: "心之鏡",
        mirrorLineHistory: "回看至今為止的對話。",
        mirrorLineDefault: "照見此刻的自己。",
        rhythmTitle: "理解節奏",
        rhythmLineFinal: "重新查看已完成的 Final。",
        rhythmLineDefault: "發現內心的流動。",
        nextTitle: "下一段節奏",
        nextLineRestart: "開始新的對話。",
        nextLineDefault: "一起尋找新的方向。",
      },
    },
    benefits: {
      title: "為什麼這對您有幫助：三個理由",
      core: "理解自己 → 理解他人 → 理解一起努力的事",
      body: "可以用來梳理這個過程。作為下一階段、面向機構的姊妹服務，\n您將可以使用適用於商業、項目、社會活動等範疇的自我檢視系統。",
      cta: "屆時才開放 ID 申請。",
    },
    conversation: {
      home: "主頁",
      viewFinal: "查看 Final 結果",
      restart: "重新開始",
      prevConversationAria: "之前的對話",
      showMore: (count) => `查看更多之前的對話 (${count})`,
      collapse: "收起",
      myStory: "我所說的話",
      thinking: "AURINA 正在慢慢細看您到目前為止所說的話……",
      inputPlaceholder: "寫下此刻浮現的想法。",
      continuationTitle: "如果還有其他想法",
      continuationPlaceholder: "請繼續寫下去。",
    },
    reflection: {
      title: "浮現在您心中的流動",
      subtitle: "根據至今為止的對話，我們一起看看浮現在您心中的流動。",
      mirrorLabel: "心之鏡",
      mirrorEmpty: "尚未浮現。",
      giftLabel: "心安頓的地方",
      giftEmpty: "這段流動目前尚未完全成形，但即使如此，它本身已經足夠有意義。",
      viewHistory: "重新查看對話",
      home: "主頁",
      restartTalk: "再談一次",
    },
    input: {
      textareaAria: "輸入框",
      submitAria: "繼續",
    },
    session: {
      networkError: "網絡連線暫時不太穩定，請再試一次。",
    },
  },
  // Multilingual Localization Gate — Traditional Chinese (Taiwan).
  // Drafted independently from zh-CN/zh-HK, not converted from either
  // — vocabulary (e.g. 網路/專案/收合) and softer particles follow
  // Taiwan web-service register. See zh-CN's note above re: Runtime
  // scope (fixed UI/Benefits/Notice/Advertising chrome only).
  "zh-TW": {
    localeSwitcher: LOCALE_SWITCHER,
    common: { close: "關閉" },
    arrival: {
      menuAria: "選單",
      languageIconAria: "選擇語言",
      headline: "心靈之鏡",
      description: "一起看看你現在的狀態。",
      coreQuestion: "現在，你腦海中浮現了什麼呢？",
      permissionText: "從一件小事，或是今天發生的事開始也沒關係。",
      exampleText: "例如：今天不太順利．想起了某個人．就是有點悶悶的",
      inputPlaceholder: "寫下此刻浮現的想法",
      enterHint: "按 Enter 繼續",
      voiceChip: "用語音說說看",
      anonymousChip: "匿名開始",
      trustText: "心靈之鏡不是聊天室，\n而是一扇讓你看見自己的心窗。",
      privacyText: "你在 HRI 分享的內容不會公開。",
      noticeText: "HRI 不是用來評估或診斷的工具，而是透過你現在的想法與流動，\n一起看見你的節奏。",
      noticeKicker: (date) => `公告 · ${date}`,
      historyLink: "繼續上次的對話",
      finalLink: "再看一次 Reflection",
      restartLink: "重新開始",
      adLabel: "HRI 小提醒 · 相關服務",
      adDisclaimer: "RC 是與 HRI 獨立運作的 Business Reality 服務。",
      adImageLine1: "從自我檢視開始",
      adOpeningBadge: "8月28日即將開放",
      cards: {
        mirrorTitle: "心靈之鏡",
        mirrorLineHistory: "回顧目前為止的對話。",
        mirrorLineDefault: "映照此刻的自己。",
        rhythmTitle: "理解節奏",
        rhythmLineFinal: "再看一次完成的 Final。",
        rhythmLineDefault: "發現內心的流動。",
        nextTitle: "下一段節奏",
        nextLineRestart: "開始新的對話。",
        nextLineDefault: "一起尋找新的方向。",
      },
    },
    benefits: {
      title: "這對你有幫助的三個理由",
      core: "理解自己 → 理解他人 → 理解一起努力的事",
      body: "可以用來梳理這段過程。作為下一階段、面向組織的姊妹服務，\n你將能使用適用於商業、專案、社會活動等領域的自我檢視系統。",
      cta: "屆時才開放 ID 申請哦。",
    },
    conversation: {
      home: "首頁",
      viewFinal: "查看 Final 結果",
      restart: "重新開始",
      prevConversationAria: "之前的對話",
      showMore: (count) => `查看更多之前的對話 (${count})`,
      collapse: "收合",
      myStory: "我說的話",
      thinking: "AURINA 正在慢慢感受你到目前為止說的話……",
      inputPlaceholder: "寫下此刻浮現的想法。",
      continuationTitle: "如果還有其他想法",
      continuationPlaceholder: "請繼續寫下去。",
    },
    reflection: {
      title: "浮現在你心中的流動",
      subtitle: "根據目前為止的對話，我們一起看看浮現在你心中的流動。",
      mirrorLabel: "心靈之鏡",
      mirrorEmpty: "還沒有浮現出來。",
      giftLabel: "心安放的角落",
      giftEmpty: "這段流動現在還沒有完全整理成形，但就算如此，它本身也已經足夠有意義。",
      viewHistory: "重新查看對話",
      home: "首頁",
      restartTalk: "再聊一次",
    },
    input: {
      textareaAria: "輸入欄",
      submitAria: "繼續",
    },
    session: {
      networkError: "網路連線暫時不太穩定，請再試一次。",
    },
  },
};

export function formatNoticeDate(iso: string, locale: UiLocale): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (locale === "en") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (locale === "ko") {
    return `${month}월 ${day}일`;
  }
  if (locale === "fr") {
    return d.toLocaleDateString("fr-FR", { month: "short", day: "numeric" });
  }
  // ja and every zh-* variant share the same 月/日 numeral format.
  return `${month}月${day}日`;
}
