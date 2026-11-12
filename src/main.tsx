import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import './shared/i18n/i18n';
import './styles/fonts';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado no index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
