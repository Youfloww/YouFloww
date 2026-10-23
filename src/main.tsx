import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/fredoka/wght.css';
import '@fontsource-variable/nunito/wght.css';
import './styles/index.css';
import App from './App';
import { hydrateTimer } from './features/timer/engine';
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

if (import.meta.env.PROD) registerSW({ immediate: true });
