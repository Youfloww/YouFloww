import { NotConfigured } from './admin.js';

export function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

export const fail = (status: number, error: string) => json(status, { error });

/** Small JSON object bodies only. */
export async function readJson(request: Request, max = 4096): Promise<Record<string, unknown> | null> {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return null;
  const text = await request.text();
  if (text.length > max) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Turn unexpected errors into a calm 5xx without leaking details (and never a secret) to the browser. */
export async function guard(name: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotConfigured) {
      console.error(`[pledge/${name}] not configured: ${e.message}`);
      return fail(503, 'Pledges are not available right now. Please try again later.');
    }
    console.error(`[pledge/${name}] ${e instanceof Error ? e.message.slice(0, 200) : 'error'}`);
    return fail(500, 'Something went wrong on our side. Please try again in a minute.');
  }
}
