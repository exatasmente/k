// "Fonte: ..." embaixo de todo texto de saúde. Links abrem fora do app; nada é enviado.

export function Sources({ sources }) {
  if (!sources?.length) return null;
  return (
    <div class="sources">
      {sources.length > 1 ? 'Fontes: ' : 'Fonte: '}
      {sources.map((s, i) => (
        <span key={s.id}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.short}</a></span>
      ))}
    </div>
  );
}

/** Texto de saúde (de `copyOf`) com as fontes logo abaixo. */
export function Sourced({ copy, as: Tag = 'div', ...rest }) {
  if (!copy) return null;
  return (
    <Tag {...rest}>
      <div>{copy.text}</div>
      <Sources sources={copy.sources} />
    </Tag>
  );
}
