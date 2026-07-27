type Props = {
  present?: string;
  rhythm?: string;
  emerging?: string;
};

export default function ObservationWorkspace({
  present = "Current state will appear here.",
  rhythm = "Rhythm analysis will appear here.",
  emerging = "Emerging meaning will appear here.",
}: Props) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "24px",
        marginTop: "8px",
      }}
    >
      <Panel title="PRESENT" value={present} />
      <Panel title="RHYTHM" value={rhythm} />
      <Panel title="EMERGING MEANING" value={emerging} />
    </section>
  );
}

function Panel({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "18px",
        padding: "24px",
        minHeight: "220px",
        boxShadow: "0 10px 28px rgba(0,0,0,.08)",
        border: "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#8A8F98",
          letterSpacing: ".12em",
          marginBottom: "18px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "20px",
          lineHeight: 1.7,
          color: "#222",
        }}
      >
        {value}
      </div>
    </div>
  );
}