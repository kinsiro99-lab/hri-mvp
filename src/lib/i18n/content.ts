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
 */
import type { Locale } from "@/lib/hri/locale";

export type Content = {
  localeSwitcher: {
    ko: string;
    ja: string;
    en: string;
  };
  arrival: {
    menuAria: string;
    headline: string;
    description: string;
    coreQuestion: string;
    inputPlaceholder: string;
    enterHint: string;
    voiceChip: string;
    anonymousChip: string;
    noticeText: string;
    noticeKicker: (date: string) => string;
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

export const CONTENT: Record<Locale, Content> = {
  ko: {
    localeSwitcher: { ko: "한국어", ja: "日本語", en: "English" },
    arrival: {
      menuAria: "메뉴",
      headline: "마음의 거울",
      description: "당신의 지금을 함께 바라봅니다.",
      coreQuestion: "마음에 가장 먼저 떠오르는 것은 무엇인가요?",
      inputPlaceholder: "지금 떠오르는 것을 적어보세요",
      enterHint: "Enter로 계속하기",
      voiceChip: "음성으로 이야기하기",
      anonymousChip: "익명으로 시작하기",
      noticeText: "HRI는 평가나 진단을 위한 도구가 아닙니다.\n현재 삶에 나타나는 생각과 흐름을 통해 당신의 리듬을 관찰할 수 있도록 돕습니다.",
      noticeKicker: (date) => `공지 · ${date}`,
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
    localeSwitcher: { ko: "한국어", ja: "日本語", en: "English" },
    arrival: {
      menuAria: "メニュー",
      headline: "心の鏡",
      // Checkpoint Gate — SET A (headline + description) reads as one
      // message: "this is a mirror for your heart" -> "now, look at
      // your heart." SET B (coreQuestion + input) is a separate,
      // second invitation to actually write something down. "心に" was
      // removed from coreQuestion per this Gate's explicit instruction
      // — the question is now exactly "最初に浮かぶことは何ですか？".
      description: "今、あなたの心を見てください。",
      coreQuestion: "最初に浮かぶことは何ですか？",
      inputPlaceholder: "今、浮かんでいることを書いてみてください",
      enterHint: "Enterで続ける",
      voiceChip: "音声で話す",
      anonymousChip: "匿名で始める",
      noticeText: "HRIは評価や診断のためのツールではありません。\n今の暮らしに現れる考えや流れを通して、心のリズムをそっと見つめる手助けをします。",
      noticeKicker: (date) => `お知らせ · ${date}`,
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
    localeSwitcher: { ko: "한국어", ja: "日本語", en: "English" },
    arrival: {
      menuAria: "Menu",
      headline: "Inner Mirror",
      description: "A quiet look at where things stand right now.",
      coreQuestion: "What's the first thing on your mind?",
      inputPlaceholder: "Write down what's coming up right now",
      enterHint: "Press Enter to continue",
      voiceChip: "Speak instead",
      anonymousChip: "Start anonymously",
      noticeText: "HRI is not a tool for evaluation or diagnosis.\nIt helps you quietly notice the rhythm behind what's showing up in your life right now.",
      noticeKicker: (date) => `Notice · ${date}`,
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
};

export function formatNoticeDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  if (locale === "en") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return locale === "ja" ? `${month}月${day}日` : `${month}월 ${day}일`;
}
