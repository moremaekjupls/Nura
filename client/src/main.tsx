import { createRoot } from 'react-dom/client';
import App from './App';
import { initTelegram } from './lib/telegram';
import { restoreToken } from './lib/api';
import './styles.css';

(async () => {
  if (await initTelegram()) restoreToken();
  createRoot(document.getElementById('root')!).render(<App />);
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
