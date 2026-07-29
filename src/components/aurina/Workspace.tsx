import "./aurina.css";

type Props = {
  onRestart: () => void;
};

/**
 * A different room entirely: static product guidance, not the
 * conversation. Never repeats the user's personal reflection — that
 * belongs solely to the Main Moment. Presentation only — no engine
 * calls, no state of its own.
 */
export default function Workspace({ onRestart }: Props) {
  return (
    <footer className="aurina-workspace">
      <button className="restart-btn" onClick={onRestart} type="button">
        새로 시작
      </button>

      <div className="aurina-workspace-grid">
        <section className="aurina-workspace-col">
          <h3 className="aurina-workspace-heading">오리나 (AURINA)</h3>

          <img src="/aurina-blue.png" alt="AURINA" className="aurina-workspace-photo" />

          <p className="aurina-workspace-lead">당신의 마음을 비추는 거울입니다.</p>
          <p className="aurina-text-dim">A mirror for your inner rhythm.</p>

          <h4 className="aurina-workspace-subheading">사용 방법</h4>
          <p>1. 지금 떠오르는 것을 적어보세요.</p>
          <p>2. 질문에 자연스럽게 답해보세요.</p>
          <p>3. 무엇이 보이는지 살펴보세요.</p>

          <div className="aurina-workspace-notice">
            <h4 className="aurina-text-dim">NOTICE · 공지사항</h4>
            <p className="aurina-text-dim">
              HRI는 평가나 진단을 위한 도구가 아닙니다.<br />
              현재 삶에 나타나는 생각과 흐름을 통해 당신의 리듬을 관찰할 수 있도록 돕습니다.
            </p>
          </div>
        </section>

        <section className="aurina-workspace-col">
          <h3>CURRENT · 현재</h3>
          <p className="aurina-text-dim">What is appearing in your life at this moment.</p>
          <p>지금 삶 속에 드러나고 있는 모습입니다.</p>

          <h3>RHYTHM · 리듬</h3>
          <p className="aurina-text-dim">Your mind is being reflected.</p>
          <p>당신의 마음이 비춰지고 있습니다.</p>

          <h3>MIRROR · 마음의 거울</h3>
          <p className="aurina-text-dim">What is your mind reflecting right now?</p>
          <p>지금 당신의 마음은 무엇을 비추고 있습니까?</p>

          <p className="aurina-text-dim">What is your mind reflecting now?</p>
          <p>지금 당신의 마음은 무엇을 비추고 있나요?</p>
        </section>
      </div>
    </footer>
  );
}
