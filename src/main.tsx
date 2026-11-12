import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { captureSimulatorDraft } from './features/access/simulator-draft';
import './shared/i18n/i18n';
import './styles/fonts';
import './styles/index.css';

// O rascunho do Simule chega no fragmento e é guardado antes de qualquer tela o ler (RN08).
captureSimulatorDraft();

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado no index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
