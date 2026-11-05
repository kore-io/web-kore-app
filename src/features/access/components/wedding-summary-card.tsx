/** Cartão do casamento nos convites (Penpot): os nomes e a linha de data e cidade. */
export function WeddingSummaryCard({ couple, details }: { couple: string; details: string }) {
  return (
    <div className="kore-wedding-summary">
      <p className="kore-wedding-summary__couple">{couple}</p>
      <p className="kore-wedding-summary__details">{details}</p>
    </div>
  );
}
