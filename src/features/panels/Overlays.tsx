import { useEffect } from 'react';
import { useData } from '@/store/data';
import { usePrefs } from '@/store/prefs';
import { useUI } from '@/store/ui';
import { AuthDialog } from '../auth/AuthDialog';
import { HelpDialog } from './HelpDialog';
import { Onboarding } from './Onboarding';
import { MusicPlayer } from '../sounds/MusicPlayer';
import { PresenceGuard } from '../guard/PresenceGuard';
import { APP_VERSION } from '@/lib/version';


export default function Overlays() {
  const accountability = useData((s) => !!s.data.settings.isAccountabilityOn);

  useEffect(() => {
    const p = usePrefs.getState();
    if (p.lastSeenVersion !== APP_VERSION) setTimeout(() => useUI.getState().set({ onboarding: true }), 700);
  }, []);

  return (
    <>
      <AuthDialog />
      <HelpDialog />
      <Onboarding />
      <MusicPlayer />
      {accountability && <PresenceGuard />}
    </>
  );
}
