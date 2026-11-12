/**
 * O texto do casal (Seções RN04): texto simples, uma linha em branco separa os parágrafos
 * e a quebra de linha fica. Sai sempre escapado (o React escapa; nada de HTML), e endereço
 * de site não vira link.
 */
export function SiteText({ text, className }: { text: string; className?: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((paragraph) => paragraph.trim());
  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="kore-site-text">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
