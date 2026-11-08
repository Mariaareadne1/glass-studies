import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/tokens.css';
import './styles/globals.css';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('Glass Studies: #root element missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
