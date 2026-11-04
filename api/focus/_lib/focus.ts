/**
 * The focus ledger in Firestore (Admin SDK). One transaction per report:
 *
 *   focusLedger/{uid}   server-only: the witnessed focus (see src/features/pledge/ledger.ts for the rules)
 *   publicUsers/{uid}   the public leaderboard entry, rebuilt from the ledger on every report
 *
 * Time is the server's own clock, read inside the transaction; nothing time-related comes from the browser.
 */
import { accountCreatedAt, db } from '../../pledge/_lib/admin.js';
import { applyBatch, publicEntryFor, readLedger, tooSoon, type FirstLedger, type FocusBatch } from '../../../src/features/pledge/ledger.js';

export type LogResult =
  | { ok: true; credited: number; totalSec: number; todayMin: number; streak: number; day: string }
  | { ok: false; reason: 'slow' };

/** Credit a checked batch for `uid`. `clock` is for tests only. */
export async function logFocus(uid: string, batch: FocusBatch, clock: () => number = Date.now): Promise<LogResult> {
  const fs = db();
  const ledgerRef = fs.doc(`focusLedger/${uid}`);
  const publicRef = fs.doc(`publicUsers/${uid}`);
  let createdAt: number | null = null; // kept across transaction retries
  return fs.runTransaction(async (tx): Promise<LogResult> => {
    const snap = await tx.get(ledgerRef);
    let first: FirstLedger | undefined;
    if (!snap.exists) {
      // first report ever: the account's age bounds the look-back, and the old public entry is grandfathered once
      const old = await tx.get(publicRef);
      createdAt ??= await accountCreatedAt(uid);
      first = { createdAt, publicUser: old.exists ? old.data() : null };
    }
    const now = clock();
    const prev = snap.exists ? readLedger(snap.data(), now) : null;
    if (prev && tooSoon(prev, now)) return { ok: false, reason: 'slow' };

    const { ledger, credited } = applyBatch(prev, batch.sessions, batch.tz, now, first);
    const entry = publicEntryFor(ledger, batch.name, now, batch.tz);
    tx.set(ledgerRef, ledger);
    tx.set(publicRef, entry); // replaces the whole entry: nothing the browser once wrote there survives
    return { ok: true, credited, totalSec: ledger.totalSec, todayMin: entry.todayFocusMinutes, streak: entry.currentStreak, day: entry.date };
  });
}
