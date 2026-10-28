import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { Icon } from './icons.jsx';

/** Folha inferior com fundo escurecido. Esc fecha; o foco entra na folha ao abrir. */
export function Sheet({ label, onClose, children, head }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  // No documento, não só na folha: o foco pode ainda estar no botão que a abriu.
  // Layout effect: o Esc vale assim que a folha aparece, sem esperar o próximo quadro.
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') close.current(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  return (
    <>
      <button class="scrim" aria-label="Fechar" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <div class="sheet-head">
          <div class="grabber" />
          {head}
        </div>
        {children}
      </div>
    </>
  );
}

export function CloseButton({ onClick, label = 'Fechar' }) {
  return (
    <button class="icon-btn" aria-label={label} onClick={onClick}>
      <Icon name="close" size={18} width={2.4} />
    </button>
  );
}

export function Switch({ on, onToggle, label, disabled = false }) {
  return (
    <button class="switch" aria-pressed={on ? 'true' : 'false'} aria-label={label} disabled={disabled} onClick={onToggle}>
      <span />
    </button>
  );
}
