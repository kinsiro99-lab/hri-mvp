type Props = {
  voice?: string;
};

export default function AurinaHeader({ voice }: Props) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "40px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "72px",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: "#061A44",
          }}
        >
          AURINA
        </div>

        <div
          style={{
            marginTop: "14px",
            fontSize: "24px",
            color: "#4B5563",
          }}
        >
          {voice}
        </div>
      </div>

      <video
        autoPlay
        muted
        loop
        playsInline
        style={{
          width: "240px",
          borderRadius: "18px",
          objectFit: "cover",
        }}
      >
        <source src="/videos/aurina-greeting.mp4" type="video/mp4" />
      </video>
    </header>
  );
}