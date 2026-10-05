import { lazy, Suspense, type ReactNode } from 'react';
import { useUI, type PanelId } from '@/store/ui';
import { Sheet } from '@/ui/Sheet';

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

export default function Panels() {
  const panel = useUI((s) => s.panel);
  const openPanel = useUI((s) => s.openPanel);
  const m = panel ? META[panel] : null;
  return (
    <Sheet open={!!m} onClose={() => openPanel(null)} title={m?.title} subtitle={m?.subtitle} icon={m?.icon} width={m?.width}>
      {m && (
        <Suspense fallback={<Loading />}>
          <m.C key={panel} />
        </Suspense>
      )}
    </Sheet>
  );
}
