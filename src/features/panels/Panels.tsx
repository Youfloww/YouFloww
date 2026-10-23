import { AnimatePresence } from 'motion/react';
import { lazy, Suspense, type ReactNode } from 'react';
import { useUI, type PanelId } from '@/store/ui';
import { usePrefs, type WindowRect } from '@/store/prefs';
import { Sheet, useIsDesktop } from '@/ui/Sheet';
import { FloatingWindow } from '@/ui/Window';

const TasksPanel = lazy(() => import('../tasks/TasksPanel'));
const SoundsPanel = lazy(() => import('../sounds/SoundsPanel'));
const ScenesPanel = lazy(() => import('../scene/ScenesPanel'));
const StatsPanel = lazy(() => import('../stats/StatsPanel'));
const JournalPanel = lazy(() => import('../journal/JournalPanel'));
const PlannerPanel = lazy(() => import('../planner/PlannerPanel'));
const CommunityPanel = lazy(() => import('../community/CommunityPanel'));
const AchievementsPanel = lazy(() => import('../achievements/AchievementsPanel'));
const SettingsPanel = lazy(() => import('../settings/SettingsPanel'));
const AccountPanel = lazy(() => import('../settings/AccountPanel'));

const META: Record<PanelId, { title: string; subtitle: string; icon: string; width?: number; C: React.LazyExoticComponent<() => ReactNode> }> = {
  tasks: { title: 'Tasks', subtitle: 'What matters today', icon: '📝', C: TasksPanel },
  sounds: { title: 'Sound mixer', subtitle: 'Layer your perfect ambience', icon: '🎧', C: SoundsPanel },
  scenes: { title: 'Scenes & themes', subtitle: 'Make it yours', icon: '🎨', C: ScenesPanel, width: 480 },
  stats: { title: 'Your progress', subtitle: 'Every minute counts', icon: '📈', C: StatsPanel, width: 520 },
  journal: { title: 'Journal', subtitle: 'A cozy corner for your thoughts', icon: '📔', C: JournalPanel },
  planner: { title: 'Weekly planner', subtitle: 'Shape your week', icon: '🗓️', C: PlannerPanel },
  community: { title: 'Community', subtitle: 'Focus together, worldwide', icon: '🏆', C: CommunityPanel },
  achievements: { title: 'Badges', subtitle: 'Little trophies for big habits', icon: '🏅', C: AchievementsPanel, width: 480 },
  settings: { title: 'Settings', subtitle: 'Tune your flow', icon: '⚙️', C: SettingsPanel },
  account: { title: 'Account', subtitle: 'Profile & sync', icon: '☁️', C: AccountPanel },
};

function Loading() {
  return (
    <div className="space-y-3 pt-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton h-16 rounded-3xl" />
      ))}
    </div>
  );
}

/** Where a window opens the first time: right side like the old drawer, cascading for each extra window. */
function defaultRect(id: PanelId, index: number): WindowRect {
  const w = Math.min(META[id].width ?? (id === 'planner' ? 760 : 440), innerWidth - 24);
  const h = Math.min(innerHeight - 24, 780);
  return { x: innerWidth - w - 12 - index * 36, y: 12 + index * 36, w, h };
}

export default function Panels() {
  const panels = useUI((s) => s.panels);
  const front = useUI((s) => s.panel);
  const openPanel = useUI((s) => s.openPanel);
  const closePanel = useUI((s) => s.closePanel);
  const rects = usePrefs((s) => s.windowRects);
  const desktop = useIsDesktop();

  // Phones: one bottom sheet (the front window)
  if (!desktop) {
    const m = front ? META[front] : null;
    return (
      <Sheet open={!!m} onClose={() => front && closePanel(front)} title={m?.title} subtitle={m?.subtitle} icon={m?.icon} width={m?.width}>
        {m && (
          <Suspense fallback={<Loading />}>
            <m.C key={front} />
          </Suspense>
        )}
      </Sheet>
    );
  }

  // Desktop: any number of floating windows. The DOM order stays fixed and only z-index follows the stack:
  // moving a window's node to the front mid-click would make the browser drop that click (e.g. on ×).
  const ORDER = Object.keys(META) as PanelId[];
  const stable = [...panels].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return (
    <AnimatePresence>
      {stable.map((id) => {
        const i = panels.indexOf(id);
        const m = META[id];
        return (
          <FloatingWindow
            key={id}
            title={m.title}
            subtitle={m.subtitle}
            icon={m.icon}
            rect={rects[id] ?? defaultRect(id, i)}
            z={41 + i}
            active={id === front}
            onRect={(r) => usePrefs.getState().set({ windowRects: { ...usePrefs.getState().windowRects, [id]: r } })}
            onFocus={() => id !== useUI.getState().panel && openPanel(id)}
            onClose={() => closePanel(id)}
          >
            <Suspense fallback={<Loading />}>
              <m.C />
            </Suspense>
          </FloatingWindow>
        );
      })}
    </AnimatePresence>
  );
}
