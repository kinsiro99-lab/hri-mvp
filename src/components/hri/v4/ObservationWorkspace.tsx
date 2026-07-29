import "./hri-v4.css";

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
    <section className="aur-observation">
      <Item label="PRESENT" value={present} />
      <Item label="RHYTHM" value={rhythm} />
      {/* Emerging Meaning stays concise and visually subordinate to the final Flow Summary */}
      <Item label="EMERGING MEANING" value={emerging} subordinate />
    </section>
  );
}

function Item({
  label,
  value,
  subordinate = false,
}: {
  label: string;
  value: string;
  subordinate?: boolean;
}) {
  return (
    <div className="aur-obs-item">
      <div className="aur-obs-label">{label}</div>
      <div className={`aur-obs-value${subordinate ? " aur-obs-value--subordinate" : ""}`}>
        {value}
      </div>
    </div>
  );
}
