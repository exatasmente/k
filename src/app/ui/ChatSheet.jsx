import { useState } from 'preact/hooks';
import { DISCLAIMER, suggestedQuestions } from '../assistant.js';
import { Icon } from './icons.jsx';
import { CloseButton, Sheet } from './Sheet.jsx';

/** Conversa com a assistente local. As mensagens ficam só na memória da tela. */
export function ChatSheet({ model, nav, messages, ask }) {
  const [draft, setDraft] = useState('');
  const send = (e) => {
    e.preventDefault();
    if (draft.trim()) ask(draft.trim());
    setDraft('');
  };
  const head = (
    <div class="head">
      <div class="row" style={{ flexWrap: 'nowrap' }}>
        <span style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--indigo-tint)', color: 'var(--indigo)', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <Icon name="spark" />
        </span>
        <div>
          <strong style={{ fontSize: 17 }}>Assistente</strong>
          <div class="small muted">Responde com os dados deste aparelho. Nada é enviado.</div>
        </div>
      </div>
      <CloseButton onClick={nav.close} />
    </div>
  );
  return (
    <Sheet label="Assistente" onClose={nav.close} head={head}>
      <div class="sheet-body chat" aria-live="polite">
        {messages.map((m, i) => <div key={i} class={`bubble ${m.from}`}>{m.text}</div>)}
      </div>
      <div class="chat-foot">
        <div class="pills">
          {suggestedQuestions(model).map((q) => (
            <button key={q} class="pill" onClick={() => ask(q)}>{q}</button>
          ))}
        </div>
        <form class="row" style={{ flexWrap: 'nowrap' }} onSubmit={send}>
          <input class="field" style={{ borderRadius: 23, height: 46 }} aria-label="Escreva sua pergunta" placeholder="Pergunte sobre seu ciclo"
            value={draft} onInput={(e) => setDraft(e.currentTarget.value)} />
          <button type="submit" class="icon-btn" aria-label="Enviar" style={{ background: 'var(--indigo)', color: '#fff', border: 0 }}>
            <Icon name="next" size={20} width={2.2} />
          </button>
        </form>
        <div class="small muted" style={{ textAlign: 'center' }}>{DISCLAIMER}</div>
      </div>
    </Sheet>
  );
}
