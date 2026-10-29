/**
 * Firebase Admin (server only): verifies ID tokens and reads/writes Firestore past the security rules.
 * Credentials: FIREBASE_SERVICE_ACCOUNT = the service-account JSON (raw or base64). Locally, the Auth +
 * Firestore emulators work without credentials (FIREBASE_AUTH_EMULATOR_HOST + FIRESTORE_EMULATOR_HOST).
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { deployed } from './env.js';

const NAME = 'floww-pledge';

export class NotConfigured extends Error {}

function app(): App {
  const existing = getApps().find((a) => a.name === NAME);
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    let json: { project_id?: string; client_email?: string; private_key?: string };
    try {
      json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      throw new NotConfigured('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    }
    if (!json.project_id || !json.client_email || !json.private_key) throw new NotConfigured('FIREBASE_SERVICE_ACCOUNT is missing fields');
    return initializeApp({ credential: cert(json as { projectId?: string }), projectId: json.project_id }, NAME);
  }
  const emulators = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (emulators && !deployed()) return initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'youfloww2' }, NAME);
  throw new NotConfigured('FIREBASE_SERVICE_ACCOUNT is not set');
}

let dbCache: Firestore | null = null;
export function db(): Firestore {
  return (dbCache ??= getFirestore(app()));
}

/** The signed-in person behind `Authorization: Bearer <Firebase ID token>`, or null. */
export async function verifyUser(request: Request): Promise<{ uid: string } | null> {
  const m = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(request.headers.get('authorization') ?? '');
  if (!m) return null;
  try {
    const t = await getAuth(app()).verifyIdToken(m[1]);
    if (t.firebase?.sign_in_provider === 'anonymous') return null;
    return { uid: t.uid };
  } catch (e) {
    if (e instanceof NotConfigured) throw e;
    return null;
  }
}
