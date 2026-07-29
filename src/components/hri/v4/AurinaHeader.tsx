import "./hri-v4.css";

type Props = {
  voice?: string;
};

export default function AurinaHeader({ voice }: Props) {
  return (
    <header className="aur-arrival">
      <div className="aur-portrait">
        <video autoPlay muted loop playsInline>
          <source src="/videos/aurina-greeting.mp4" type="video/mp4" />
        </video>
      </div>

      <div className="aur-eyebrow">HUMAN RHYTHM INTELLIGENCE</div>
      <h1 className="aur-name">AURINA</h1>
      <p className="aur-voice">{voice}</p>
    </header>
  );
}
