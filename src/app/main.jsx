import { render } from 'preact';
import { openRepository } from '../data/repository.js';
import { createStore } from './store.js';
import { App } from './ui/App.jsx';
import './styles.css';

async function boot() {
  const root = document.getElementById('app');
  try {
    // Pede ao navegador para não apagar o banco por falta de espaço ou inatividade.
    navigator.storage?.persist?.();
    const repo = await openRepository();
    render(<App store={createStore(repo)} />, root);
  } catch (err) {
    root.innerHTML = '';
    render(
      <div class="screen">
        <h1 class="title">Não foi possível abrir seus dados</h1>
        <p class="muted">O navegador bloqueou o armazenamento local (janela anônima ou permissão negada). Abra o app em uma janela normal.</p>
        <p class="small muted">{String(err?.message ?? err)}</p>
      </div>,
      root,
    );
  }
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }
}

boot();
