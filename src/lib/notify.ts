import { useData } from '@/store/data';

export async function requestNotifications() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** System notification, only when the user opted in and the tab isn't visible. */
export function notify(title: string, body: string) {
  try {
    if (!useData.getState().data.settings.notifications) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    const n = new Notification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'floww-timer', silent: false });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* some mobile browsers only allow SW notifications */
  }
}

/** Screen Wake Lock while focusing, so the display doesn't sleep mid-session. */
let lock: { release: () => Promise<void> } | null = null;
export async function setWakeLock(on: boolean) {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (on && wl && !lock && document.visibilityState === 'visible') lock = await wl.request('screen');
    if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}
