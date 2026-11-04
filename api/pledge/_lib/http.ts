import { NotConfigured } from './admin.js';

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export const fail = (status: number, error: string) => json(status, { error });

/** Small JSON object bodies only (at most `max` bytes); anything else is null. */
export async function readJson(request: Request, max = 4096): Promise<Record<string, unknown> | null> {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return null;
  const text = await readText(request, max);
  if (text === null) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The body as UTF-8 text, or null past `max` bytes (reading stops there, so a huge body is never buffered whole). */
async function readText(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? '') > max) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      reader.cancel().catch(() => {});
      return null;
    }
    parts.push(value);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts));
  } catch {
    return null; // not UTF-8
  }
}

const UNAVAILABLE = {
  pledge: 'Pledges are not available right now. Please try again later.',
  focus: 'Focus sync is not available right now. Please try again later.',
} as const;

/** Turn unexpected errors into a calm 5xx without leaking details (and never a secret) to the browser. */
export async function guard(name: string, fn: () => Promise<Response>, area: keyof typeof UNAVAILABLE = 'pledge'): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotConfigured) {
      console.error(`[${area}/${name}] not configured: ${e.message}`);
      return fail(503, UNAVAILABLE[area]);
    }
    console.error(`[${area}/${name}] ${e instanceof Error ? e.message.slice(0, 200) : 'error'}`);
    return fail(500, 'Something went wrong on our side. Please try again in a minute.');
  }
}
