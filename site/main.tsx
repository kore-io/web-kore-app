import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SiteApp } from '../src/site/site-app';
import '../src/site/i18n';
import '../src/site/site.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado no site/index.html');

createRoot(root).render(
  <StrictMode>
    <SiteApp />
  </StrictMode>,
);
