/**
 * Browser side of Focus Pledge. The browser never decides anything about money: it asks /api/pledge/* (which
 * verifies everything with Firebase Admin and Razorpay) and only READS its own pledges from Firestore.
 */
import { create } from 'zustand';
import { firebase } from '@/services/firebase';
import { TERMS_VERSION, type Goal, type PledgeAmount, type PledgeDoc, type PledgeStats } from './rules';

interface PledgeState {
  /** this person's pledges, newest first (null while loading) */
  pledges: PledgeDoc[] | null;
  stats: PledgeStats | null;
  loadError: string | null;
  /** Firebase ID token for the API (swappable so the UI can be exercised without a real sign-in) */
  getToken: () => Promise<string>;
}

async function realToken() {
  const fb = await firebase();
  const u = fb.auth.currentUser;
  if (!u) throw new Error('Please sign in again to continue.');
  return u.getIdToken();
}

export const usePledge = create<PledgeState>()(() => ({ pledges: null, stats: null, loadError: null, getToken: realToken }));

/** Live list of my pledges + the public totals. Returns a cleanup that detaches every listener. */
export function watchPledges(uid: string | null) {
  let alive = true;
  const offs: (() => void)[] = [];
  void (async () => {
    try {
      const { db, fsMod, auth } = await firebase();
      if (!alive) return;
      offs.push(
        fsMod.onSnapshot(
          fsMod.doc(db, 'pledgeStats', 'public'),
          (s) => usePledge.setState({ stats: (s.data() as PledgeStats | undefined) ?? {} }),
          () => usePledge.setState((st) => ({ stats: st.stats ?? {} })),
        ),
      );
      // only the signed-in owner can read their pledges (Firestore rule: request.auth.uid == resource.data.uid)
      if (!uid || auth.currentUser?.uid !== uid) return;
      const q = fsMod.query(fsMod.collection(db, 'pledges'), fsMod.where('uid', '==', uid), fsMod.limit(60));
      offs.push(
        fsMod.onSnapshot(
          q,
          (snap) => {
            const list = snap.docs.map((d) => ({ ...(d.data() as PledgeDoc), id: d.id })).sort((a, b) => b.createdAt - a.createdAt);
            usePledge.setState({ pledges: list, loadError: null });
          },
          () => usePledge.setState({ loadError: "Couldn't load your pledges. Check your connection." }),
        ),
      );
    } catch {
      usePledge.setState({ loadError: "Couldn't reach the server. Check your connection." });
    }
  })();
  return () => {
    alive = false;
    offs.forEach((off) => off());
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const token = await usePledge.getState().getToken();
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  } catch {
    throw new Error('You seem to be offline. Nothing was charged.');
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || (res.status === 404 ? 'Pledges are not available on this server.' : 'Something went wrong. Please try again.'));
  return json;
}

export interface CreatedOrder {
  orderId: string;
  amountPaise: number;
  mode: 'razorpay' | 'stub';
  keyId: string | null;
}

export const createOrder = (amount: PledgeAmount, goal: Goal) =>
  post<CreatedOrder>('/api/pledge/create', { amount, goal, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, adult: true, terms: TERMS_VERSION });

export interface VerifyBody {
  orderId: string;
  paymentId?: string;
  signature?: string;
}

const PENDING_KEY = 'floww:pledge-pending';

/**
 * Confirm a payment with the server, retrying a few times. The checkout response is kept in localStorage
 * until the server accepts it, so a closed tab or a dropped connection can finish on the next visit
 * (the Razorpay webhook is a second backstop).
 */
export async function verifyPayment(body: VerifyBody) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(body));
  } catch {
    /* private mode */
  }
  let last: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await post<{ pledgeId: string; status: string; duplicate: boolean; mode: string }>('/api/pledge/verify', body);
      clearPending();
      return r;
    } catch (e) {
      last = e;
      // only network trouble / 5xx is worth retrying; a clear refusal won't change, so forget the record
      if (!(e instanceof Error) || !/offline|went wrong/i.test(e.message)) {
        clearPending();
        break;
      }
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw last;
}

export function readPending(): VerifyBody | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    return v && typeof v.orderId === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ Razorpay Checkout (loaded only when paying) */

interface RzpResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RzpInstance {
  open(): void;
  on(event: 'payment.failed', cb: (r: { error?: { description?: string } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RzpInstance;
  }
}

let loading: Promise<void> | null = null;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return (loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Couldn't open the payment window. Check your connection and try again."));
    };
    document.head.appendChild(s);
  }));
}

export async function payWithRazorpay(order: CreatedOrder, who: { name?: string | null; email?: string | null }, description: string) {
  await loadCheckout();
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ff8a4c';
  return new Promise<RzpResponse>((resolve, reject) => {
    // a failed attempt keeps the window open so the person can retry; only closing it ends the promise
    let lastFail = '';
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amountPaise,
      currency: 'INR',
      order_id: order.orderId,
      // YouFloww's name and logo on the checkout; the money goes through the owner's giftasite account, and the
      // bank statement says giftasite, so the line under the name says so too
      name: 'YouFloww',
      image: `${location.origin}/icons/icon-192.png`,
      description: `${description} · paid via giftasite`,
      prefill: { name: who.name ?? undefined, email: who.email ?? undefined },
      notes: { app: 'YouFloww Focus Pledge' },
      theme: { color: accent },
      handler: resolve,
      modal: {
        ondismiss: () => reject(new Error(lastFail ? `${lastFail.replace(/\.?$/, '.')} No money was taken.` : 'Payment cancelled. Nothing was charged.')),
        confirm_close: true,
      },
    });
    rzp.on('payment.failed', (r) => void (lastFail = r.error?.description || 'Payment failed'));
    rzp.open();
  });
}
