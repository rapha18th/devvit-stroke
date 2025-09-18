import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const el = document.getElementById('root');
if (!el) {
  const fallback = document.createElement('div');
  fallback.id = 'root';
  document.body.appendChild(fallback);
}
createRoot(document.getElementById('root')!).render(<App />);
