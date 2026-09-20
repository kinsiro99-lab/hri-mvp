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
    /** Final Voice Reflection Gate (STEP V8) — labels for the
     *  speechSynthesis listen/stop toggle button. */
    listenVoice: string;
    stopVoice: string;
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
      description: "지금 내 마음을 조금 더 들여다봅니다.",
      coreQuestion: "오늘 있었던 일이나 지금 떠오르는 이야기에서 시작해보세요.",
      permissionText: "고민이 없어도 상관없습니다.",
      exampleText: "예: 오늘 일이 잘 안 풀렸다 · 누군가 생각난다 · 그냥 조금 답답하다",
      inputPlaceholder: "지금 생각나는 것을 적어보세요",
      enterHint: "Enter로 계속하기",
      voiceChip: "음성으로 이야기하기",
      anonymousChip: "익명으로 시작하기",
      trustText: "마음의 거울은 채팅방이 아닙니다.\n평가나 진단을 위한 도구도 아닙니다.\n\n당신을 위한 마음의 창입니다.",
      privacyText: "HRI에서 나눈 이야기는 외부에 공개되지 않습니다.",
      noticeText: "지금의 생각과 흐름을 스스로 바라볼 수 있도록 HRI가 함께합니다.",
      noticeKicker: (date) => `공지 · ${date}`,
      historyLink: "이전 대화 이어보기",
      finalLink: "Reflection 다시 보기",
      restartLink: "새로 시작하기",
      adLabel: "HRI 안내 · 관련 서비스",
      adDisclaimer: "RC는 HRI와 독립적으로 운영되는 Business Reality 서비스입니다.",
      adImageLine1: "자가진단부터 시작하는",
      adOpeningBadge: "9월 말 오픈 예정",
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
      title: "‘마음의 거울’이 당신에게 도움이 되는 이유 3가지",
      core: "나를 이해 → 다른 사람을 이해 → 함께하는 일을 이해",
      body: "나를 이해하는 것에서 시작해\n사람과의 관계와 함께하는 일을 바라보는 데 활용하세요.",
      cta: "다음 단계에서는 조직을 바라보는 HRI와 사업·프로젝트·사회활동을 위한 자매 서비스를 이용할 수 있습니다. ID 신청은 그때 가능합니다!",
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
      listenVoice: "AURINA의 목소리로 듣기",
      stopVoice: "멈추기",
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
      description: "今、自分の心をもう少しだけのぞいてみましょう。",
      coreQuestion: "今日あったことや、今ふと浮かぶ話から始めてみてください。",
      permissionText: "特に悩みがなくても構いません。",
      exampleText: "例：今日はうまくいかなかった・誰かのことを思い出す・なんとなく気が重い",
      inputPlaceholder: "今、思いつくことを書いてみてください",
      enterHint: "Enterで続ける",
      voiceChip: "音声で話す",
      anonymousChip: "匿名で始める",
      trustText: "心の鏡はチャットルームではありません。\n評価や診断のための道具でもありません。\n\nあなたのための、心の窓です。",
      privacyText: "HRIで話した内容は、外部には公開されません。",
      noticeText: "今の考えや流れを、自分自身で見つめられるようHRIが寄り添います。",
      noticeKicker: (date) => `お知らせ · ${date}`,
      historyLink: "前の対話を続ける",
      finalLink: "Reflectionをもう一度見る",
      restartLink: "新しく始める",
      adLabel: "HRIからのご案内 · 関連サービス",
      adDisclaimer: "RCはHRIとは独立して運営されるBusiness Realityサービスです。",
      adImageLine1: "セルフ診断から始める",
      adOpeningBadge: "9月末オープン予定",
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
      title: "「心の鏡」があなたに役立つ3つの理由",
      core: "自分を理解する → 他者を理解する → ともに取り組むことを理解する",
      body: "自分を理解することから始めて、\n人との関係や、ともに取り組むことを見つめるために役立ててください。",
      cta: "次の段階では、組織を見つめるHRIや、ビジネス・プロジェクト・社会活動のための姉妹サービスをご利用いただけます。IDの申請は、その時にご案内します！",
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
      listenVoice: "AURINAの声で聞く",
      stopVoice: "止める",
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
      description: "A closer look at what's going on inside, right now.",
      coreQuestion: "Start with something from today, or whatever's on your mind right now.",
      permissionText: "You don't need to have a particular worry or problem to begin.",
      exampleText: "e.g. today didn't go so well · someone's on my mind · just feeling a bit heavy",
      inputPlaceholder: "Write down whatever comes to mind",
      enterHint: "Press Enter to continue",
      voiceChip: "Speak instead",
      anonymousChip: "Start anonymously",
      trustText: "Inner Mirror is not a chat room.\nIt's not a tool for evaluation or diagnosis, either.\n\nA window for looking at yourself.",
      privacyText: "What you share with HRI is not made public.",
      noticeText: "HRI is here to help you look at your own thoughts and flow, in your own way.",
      noticeKicker: (date) => `Notice · ${date}`,
      historyLink: "Continue previous conversation",
      finalLink: "View Reflection again",
      restartLink: "Start over",
      adLabel: "HRI · Related Service",
      adDisclaimer: "RC is a Business Reality service operated independently of HRI.",
      adImageLine1: "Start with Self-Assessment",
      adOpeningBadge: "Opening late September",
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
      title: "Three reasons Inner Mirror can help you",
      core: "Understand yourself → Understand others → Understand what you're building together",
      body: "Start by understanding yourself,\nthen use it to look at your relationships and the work you're building together.",
      cta: "As the next stage, you'll gain access to HRI for organizations and a companion service for business, projects, and social initiatives. ID sign-ups will open at that stage!",
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
      listenVoice: "Listen in AURINA's voice",
      stopVoice: "Stop",
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
      description: "Un regard un peu plus attentif sur ce qui se passe en vous, là, maintenant.",
      coreQuestion: "Commencez par quelque chose d'aujourd'hui, ou par ce qui vous vient à l'esprit là, maintenant.",
      permissionText: "Vous pouvez aussi commencer sans avoir de préoccupation particulière.",
      exampleText: "ex. la journée a été difficile · je pense à quelqu'un · je me sens un peu lourd",
      inputPlaceholder: "Écrivez ce qui vous vient à l'esprit",
      enterHint: "Appuyez sur Entrée pour continuer",
      voiceChip: "Parler à la place",
      anonymousChip: "Commencer anonymement",
      trustText: "Miroir intérieur n'est pas un salon de discussion.\nCe n'est pas non plus un outil d'évaluation ou de diagnostic.\n\nUne fenêtre pour vous regarder vous-même.",
      privacyText: "Ce que vous partagez avec HRI n'est pas rendu public.",
      noticeText: "HRI est là pour vous aider à observer vos propres pensées et leur mouvement, à votre façon.",
      noticeKicker: (date) => `Avis · ${date}`,
      historyLink: "Continuer la conversation précédente",
      finalLink: "Revoir la Reflection",
      restartLink: "Recommencer",
      adLabel: "HRI · Service partenaire",
      adDisclaimer: "RC est un service Business Reality, exploité indépendamment de HRI.",
      adImageLine1: "Commencez par une auto-évaluation",
      adOpeningBadge: "Ouverture fin septembre",
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
      title: "Trois raisons pour lesquelles « Miroir intérieur » peut vous aider",
      core: "Se comprendre soi-même → Comprendre les autres → Comprendre ce que vous construisez ensemble",
      body: "Commencez par vous comprendre vous-même,\npuis utilisez-le pour observer vos relations et ce que vous construisez ensemble.",
      cta: "À l'étape suivante, vous aurez accès à HRI pour les organisations et à un service complémentaire pour les entreprises, les projets et les initiatives sociales. Les inscriptions ID ouvriront à cette étape !",
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
      listenVoice: "Écouter avec la voix d'AURINA",
      stopVoice: "Arrêter",
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
      description: "更仔细地看看此刻你内心的状态。",
      coreQuestion: "可以从今天发生的事，或者此刻想到的任何事开始。",
      permissionText: "即使没有特别的烦恼，也可以从这里开始。",
      exampleText: "例如：今天不太顺利 · 突然想起了某个人 · 就是有点闷",
      inputPlaceholder: "写下你现在想到的事",
      enterHint: "按 Enter 继续",
      voiceChip: "用语音说说看",
      anonymousChip: "匿名开始",
      trustText: "心镜不是聊天室。\n也不是用来评估或诊断的工具。\n\n它是一扇让你看见自己的心灵之窗。",
      privacyText: "你在 HRI 中分享的内容不会公开。",
      noticeText: "HRI 陪伴你，用自己的方式看见此刻的想法与状态。",
      noticeKicker: (date) => `公告 · ${date}`,
      historyLink: "继续之前的对话",
      finalLink: "再看一次 Reflection",
      restartLink: "重新开始",
      adLabel: "HRI 推荐 · 相关服务",
      adDisclaimer: "RC 是与 HRI 独立运营的 Business Reality 服务。",
      adImageLine1: "从自我诊断开始",
      adOpeningBadge: "9月底即将开放",
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
      title: "「心镜」对你有帮助的三个理由",
      core: "理解自己 → 理解他人 → 理解共同的事业",
      body: "从理解自己开始，\n用它来看看你的人际关系，以及你们共同在做的事。",
      cta: "下一阶段，你将能使用面向组织的 HRI，以及面向商业、项目、社会活动的姊妹服务。届时才开放 ID 申请！",
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
      listenVoice: "用AURINA的声音听",
      stopVoice: "停止",
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
      description: "更仔細地看看您此刻的內心狀態。",
      coreQuestion: "可以從今天發生的事，或者此刻想起的任何事開始。",
      permissionText: "即使沒有特別的煩惱，也可以從這裡開始。",
      exampleText: "例如：今日不太順利 · 突然想起某個人 · 只是有點鬱悶",
      inputPlaceholder: "寫下您此刻想到的事",
      enterHint: "按 Enter 繼續",
      voiceChip: "用語音講講看",
      anonymousChip: "匿名開始",
      trustText: "心之鏡不是聊天室，\n也不是評估或診斷的工具。\n\n而是讓您看見自己的一扇心窗。",
      privacyText: "您在 HRI 分享的內容不會對外公開。",
      noticeText: "HRI 陪伴您，讓您以自己的方式看見此刻的想法與狀態。",
      noticeKicker: (date) => `公告 · ${date}`,
      historyLink: "繼續之前的對話",
      finalLink: "重新查看 Reflection",
      restartLink: "重新開始",
      adLabel: "HRI 推薦 · 相關服務",
      adDisclaimer: "RC 是與 HRI 獨立運營的 Business Reality 服務。",
      adImageLine1: "由自我檢視開始",
      adOpeningBadge: "9月底即將開放",
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
      title: "「心之鏡」對您有幫助的三個理由",
      core: "理解自己 → 理解他人 → 理解一起努力的事",
      body: "由理解自己開始，\n用來看見您的人際關係，以及一起努力的事。",
      cta: "下一階段，您將可以使用面向機構的 HRI，以及適用於商業、項目、社會活動的姊妹服務。屆時才開放 ID 申請！",
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
      listenVoice: "用AURINA嘅聲音聽",
      stopVoice: "停止",
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
      description: "更仔細地看看你現在的內心狀態。",
      coreQuestion: "可以從今天發生的事，或是此刻浮現的任何想法開始。",
      permissionText: "即使沒有特別的煩惱，也可以從這裡開始。",
      exampleText: "例如：今天不太順利．想起了某個人．就是有點悶悶的",
      inputPlaceholder: "寫下你現在想到的事",
      enterHint: "按 Enter 繼續",
      voiceChip: "用語音說說看",
      anonymousChip: "匿名開始",
      trustText: "心靈之鏡不是聊天室，\n也不是評估或診斷的工具。\n\n而是一扇讓你看見自己的心窗。",
      privacyText: "你在 HRI 分享的內容不會公開。",
      noticeText: "HRI 陪著你，讓你能用自己的方式看見此刻的想法與流動。",
      noticeKicker: (date) => `公告 · ${date}`,
      historyLink: "繼續上次的對話",
      finalLink: "再看一次 Reflection",
      restartLink: "重新開始",
      adLabel: "HRI 小提醒 · 相關服務",
      adDisclaimer: "RC 是與 HRI 獨立運作的 Business Reality 服務。",
      adImageLine1: "從自我檢視開始",
      adOpeningBadge: "9月底即將開放",
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
      title: "「心靈之鏡」對你有幫助的三個理由",
      core: "理解自己 → 理解他人 → 理解一起努力的事",
      body: "從理解自己開始，\n用來看見你的人際關係，以及一起努力的事。",
      cta: "下一階段，你將能使用面向組織的 HRI，以及適用於商業、專案、社會活動的姊妹服務。屆時才開放 ID 申請！",
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
      listenVoice: "用AURINA的聲音聽",
      stopVoice: "停止",
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
