import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/fredoka/wght.css';
import '@fontsource-variable/nunito/wght.css';
import './styles/index.css';
import App from './App';
import { hydrateTimer, whenNotFocusing } from './features/timer/engine';
import { initPlannedTasks } from './features/planner/plannedTasks';
import { initSync } from './services/sync';
import { registerSW } from 'virtual:pwa-register';

hydrateTimer();
initSync();
initPlannedTasks();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

// A new version reloads the page, but never in the middle of a focus session: it waits until that ends or pauses
if (import.meta.env.PROD)
  registerSW({
    immediate: true,
    onNeedReload: () => whenNotFocusing(() => location.reload()),
    // look for a new version at start, when coming back to the tab and every 30 min, so nobody sits on an old one
    onRegisteredSW: (_url, r) => {
      if (!r) return;
      const check = () => void r.update().catch(() => {});
      check();
      setInterval(check, 30 * 60_000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    },
  });
