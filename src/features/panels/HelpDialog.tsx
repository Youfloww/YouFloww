import { useUI } from '@/store/ui';
import { Dialog } from '@/ui/Sheet';
import { Kbd } from '@/ui/primitives';
import { isMac } from '@/lib/utils';

const GROUPS: [string, [string, string][]][] = [
  ['Timer', [['Space', 'Start / pause'], ['R', 'Reset'], ['E', 'End & log / skip break'], ['1 2 3', 'Focus / short / long'], ['+ −', 'Add or remove 5 min'], ['D', 'Park a distracting thought']]],
  ['Panels', [['T', 'Tasks'], ['S', 'Sounds'], ['B', 'Scenes'], ['G', 'Stats'], ['J', 'Journal'], ['P', 'Planner'], ['L', 'Community'], ['A', 'Badges'], [',', 'Settings']]],
  ['Vibes', [['Z', 'Zen mode'], ['O', 'Pop-out timer'], ['M', 'Mute ambience'], [isMac ? '⌘ K' : 'Ctrl K', 'Command menu'], ['Esc', 'Close / exit']]],
];

export function HelpDialog() {
  const open = useUI((s) => s.help);
  const set = useUI((s) => s.set);
  return (
    <Dialog open={open} onClose={() => set({ help: false })} labelledBy="help-title">
      <h2 id="help-title" className="font-display mb-4 text-2xl font-semibold">
        ⌨️ Shortcuts
      </h2>
      <div className="space-y-4">
        {GROUPS.map(([g, items]) => (
          <div key={g}>
            <p className="mb-1.5 text-[11px] font-black tracking-wider text-muted uppercase">{g}</p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {items.map(([k, l]) => (
                <div key={l} className="flex items-center justify-between gap-2 text-sm font-bold">
                  <span>{l}</span>
                  <span className="flex gap-1">
                    {k.split(' ').map((x) => (
                      <Kbd key={x}>{x}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
