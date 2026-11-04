/**
 * The focus a ledger pledge (`src: 'ledger'`) is judged on, live in the browser: the person's focusLedger/{uid}
 * (server-written, owner-readable) plus this device's sessions still waiting to be sent, so the ring moves the
 * moment a session ends. Only the server's copy decides the pledge; the queued part is a preview.
 */
import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/store/data';
import { firebase } from '@/services/firebase';
import { queuedSessions, useLedgerQueue } from '@/services/focusLedger';
import { ledgerFocusLog } from './ledger';
import type { FocusLog } from './rules';

export function useLedgerLog(enabled: boolean): FocusLog | null {
  const uid = useData((s) => s.user?.uid ?? null);
  const rev = useLedgerQueue((s) => s.rev);
  const [doc, setDoc] = useState<unknown>(undefined);

  useEffect(() => {
    if (!enabled || !uid) return;
    let off: (() => void) | null = null;
    let gone = false;
    void firebase()
      .then(({ fsMod, db }) => {
        if (gone) return;
        off = fsMod.onSnapshot(
          fsMod.doc(db, 'focusLedger', uid),
          (snap) => setDoc(snap.exists() ? snap.data() : null),
          () => setDoc(null),
        );
      })
      .catch(() => setDoc(null));
    return () => {
      gone = true;
      off?.();
      setDoc(undefined);
    };
  }, [enabled, uid]);

  return useMemo(() => {
    if (!enabled || !uid || doc === undefined) return null;
    const log = ledgerFocusLog(doc);
    const queued = queuedSessions(uid).map((x) => ({ at: x.end - x.sec * 1000, sec: x.sec }));
    if (!queued.length) return log;
    const sessions = [...(log.sessionLog as { at: number; sec: number }[]), ...queued];
    return { ...log, sessionLog: sessions, totalFocusSeconds: (log.totalFocusSeconds as number) + queued.reduce((a, x) => a + x.sec, 0) };
    // rev: the queue changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, uid, doc, rev]);
}
