/**
 * Real tests of database.rules.json against the RTDB emulator (REST + unsigned mock ID tokens).
 * Run through `firebase emulators:exec` (see README.md). Exits 1 if any expectation fails.
 */
const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const NS = 'demo-youfloww-default-rtdb';
const TS = { '.sv': 'timestamp' };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (uid) => {
  const t = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, user_id: uid, aud: 'demo-youfloww', iss: 'https://securetoken.google.com/demo-youfloww', iat: t, exp: t + 3600, auth_time: t, firebase: { sign_in_provider: 'anonymous', identities: {} } })}.`;
};

async function call(method, path, uid, body) {
  const url = new URL(`http://${HOST}/${path}.json`);
  url.searchParams.set('ns', NS);
  const headers = { 'content-type': 'application/json' };
  if (uid === 'ADMIN') headers.authorization = 'Bearer owner';
  else if (uid) url.searchParams.set('auth', token(uid));
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* empty */
  }
  return { ok: r.ok, status: r.status, json };
}
const put = (p, u, b) => call('PUT', p, u, b);
const patch = (p, u, b) => call('PATCH', p, u, b);
const get = (p, u) => call('GET', p, u);
const del = (p, u) => call('DELETE', p, u);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
async function expect(name, want, p) {
  const r = await p;
  const good = want === 'allow' ? r.ok : !r.ok && (r.status === 401 || r.status === 403);
  if (good) pass++;
  else fail++;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${want.padEnd(5)}  ${name}${good ? '' : `  (got ${r.status} ${JSON.stringify(r.json)})`}`);
  return r;
}

const A = 'alice-uid';
const B = 'bob-uid';
const C = 'cara-uid';
const D = 'dan-uid';
const seat = (u, extra = {}) => ({ u, n: 'Mochi', a: 1, w: 'chem', s: 'f', e: Date.now() + 60_000, d: 1_500_000, h: TS, g: '', ...extra });

await put('', 'ADMIN', null);

console.log('\n# legacy status block');
await expect('own status write', 'allow', put(`status/${A}`, A, { state: 'online' }));
await expect("someone else's status", 'deny', put(`status/${A}`, B, { state: 'x' }));

console.log('\n# seats');
await expect('read seats signed out', 'deny', get('halls/r1/seats', null));
await expect('A claims r1/s0', 'allow', put('halls/r1/seats/s0', A, seat(A)));
await expect("B writes A's seat", 'deny', put('halls/r1/seats/s0', B, seat(B)));
await expect("B patches A's seat name", 'deny', patch('halls/r1/seats/s0', B, { n: 'hacked' }));
await expect('B claims s1 pretending to be A', 'deny', put('halls/r1/seats/s1', B, seat(A)));
await expect('B claims r1/s1', 'allow', put('halls/r1/seats/s1', B, seat(B)));
await expect('C claims s35 (36th seat)', 'allow', put('halls/r1/seats/s35', C, seat(C)));
await expect('D claims s36 (no 37th seat)', 'deny', put('halls/r1/seats/s36', D, seat(D)));
await expect('D claims hall r51', 'deny', put('halls/r51/seats/s0', D, seat(D)));
await expect('D claims seat with an extra field', 'deny', put('halls/r1/seats/s2', D, seat(D, { x: 'free text' })));
await expect('D claims seat with a 21-char name', 'deny', put('halls/r1/seats/s2', D, seat(D, { n: 'x'.repeat(21) })));
await expect('D claims seat with animal 8', 'deny', put('halls/r1/seats/s2', D, seat(D, { a: 8 })));
await expect('D claims seat with a 41-char note', 'deny', put('halls/r1/seats/s2', D, seat(D, { w: 'x'.repeat(41) })));
await expect('A heartbeat (server time)', 'allow', patch('halls/r1/seats/s0', A, { h: TS }));
await expect('A fakes an old heartbeat', 'deny', patch('halls/r1/seats/s0', A, { h: 123 }));
await expect('A updates status/timer', 'allow', patch('halls/r1/seats/s0', A, { s: 'p', e: 30_000, d: 1_500_000, h: TS }));
await expect('read seats signed in', 'allow', get('halls/r1/seats', D));
await expect("B removes A's live seat", 'deny', del('halls/r1/seats/s0', B));
await put('halls/r1/seats/s5', 'ADMIN', { ...seat('ghost'), h: Date.now() - 11 * 60_000 });
await expect('C clears a ghost seat (silent 11 min)', 'allow', del('halls/r1/seats/s5', C));

console.log('\n# hall presets (say)');
const say = (k, s, r, extra = {}) => ({ t: TS, k, s, r, ...extra });
await expect('A -> B "good luck"', 'allow', put(`halls/r1/say/${B}/${A}`, A, say('gl', 's0', 's1')));
await expect('A -> B again within 10 s (spam)', 'deny', put(`halls/r1/say/${B}/${A}`, A, say('nf', 's0', 's1')));
await expect('A -> C free-text code', 'deny', put(`halls/r1/say/${C}/${A}`, A, say('hello you', 's0', 's35')));
await expect('A -> C unknown code', 'deny', put(`halls/r1/say/${C}/${A}`, A, say('xx', 's0', 's35')));
await expect('A -> C preset + extra text field', 'deny', put(`halls/r1/say/${C}/${A}`, A, say('gl', 's0', 's35', { x: 'hi there' })));
await expect("A -> C with a fake time", 'deny', put(`halls/r1/say/${C}/${A}`, A, { t: 5, k: 'gl', s: 's0', r: 's35' }));
await expect('B -> C claiming to sit in s0 (A)', 'deny', put(`halls/r1/say/${C}/${B}`, B, say('gl', 's0', 's35')));
await expect('C writes as A (impersonation)', 'deny', put(`halls/r1/say/${B}/${A}`, C, say('gl', 's35', 's1')));
await expect('A -> C with wrong receiver seat', 'deny', put(`halls/r1/say/${C}/${A}`, A, say('gl', 's0', 's1')));
await expect('D (not seated) -> A', 'deny', put(`halls/r1/say/${A}/${D}`, D, say('gl', 's2', 's0')));
await expect('A -> A (self)', 'deny', put(`halls/r1/say/${A}/${A}`, A, say('gl', 's0', 's0')));
await expect('A -> C "break buddy?"', 'allow', put(`halls/r1/say/${C}/${A}`, A, say('bb', 's0', 's35')));
await expect("A deletes the message in B's inbox", 'deny', del(`halls/r1/say/${B}/${A}`, A));
await expect("C clears B's inbox", 'deny', del(`halls/r1/say/${B}`, C));
await expect('B removes one message from own inbox', 'allow', del(`halls/r1/say/${B}/${A}`, B));
await expect('B clears own inbox', 'allow', del(`halls/r1/say/${B}`, B));
await put(`halls/r1/say/${B}/${A}`, 'ADMIN', { t: Date.now() - 11_000, k: 'gl', s: 's0', r: 's1' });
await expect('A -> B after the 10 s cooldown', 'allow', put(`halls/r1/say/${B}/${A}`, A, say('yg', 's0', 's1')));

console.log('\n# kudos (legacy)');
await expect('A high-fives B', 'allow', put(`halls/r1/kudos/${B}/${A}`, A, { t: TS, k: 'hf', c: 1 }));
await expect('A high-fives B again within 2 min', 'deny', put(`halls/r1/kudos/${B}/${A}`, A, { t: TS, k: 'hf', c: 2 }));
await expect('A kudos with an unknown kind', 'deny', put(`halls/r1/kudos/${C}/${A}`, A, { t: TS, k: 'lol', c: 1 }));

console.log('\n# "study together?" requests');
const req = (s, r, g = '') => ({ t: TS, s, r, g });
await expect('A asks B without the per-sender stamp', 'deny', put(`halls/r1/req/${B}/${A}`, A, req('s0', 's1')));
await expect('A asks B (+ seat stamp, one update)', 'allow', patch('halls/r1', A, { [`req/${B}/${A}`]: req('s0', 's1'), 'seats/s0/q': TS }));
await expect('A asks C right away (20 s per-sender limit)', 'deny', patch('halls/r1', A, { [`req/${C}/${A}`]: req('s0', 's35'), 'seats/s0/q': TS }));
await expect('A asks B again (2 min per pair)', 'deny', patch('halls/r1', A, { [`req/${B}/${A}`]: req('s0', 's1'), 'seats/s0/q': TS }));
await expect('C asks B pretending to be A', 'deny', patch('halls/r1', C, { [`req/${B}/${A}`]: req('s35', 's1'), 'seats/s35/q': TS }));
await expect('C asks B with free text in g', 'deny', patch('halls/r1', C, { [`req/${B}/${C}`]: req('s35', 's1', 'hello'), 'seats/s35/q': TS }));
await expect("C reads B's requests", 'deny', get(`halls/r1/req/${B}`, C));
const inbox = await expect('B reads own requests', 'allow', get(`halls/r1/req/${B}`, B));
const qt = inbox.json?.[A]?.t;
await put(`halls/r1/req/${B}/${D}`, 'ADMIN', { t: Date.now(), s: 's2', r: 's1', g: '' });
await expect('B declines just one of two requests', 'allow', del(`halls/r1/req/${B}/${D}`, B));
await expect("C deletes A's request to B", 'deny', del(`halls/r1/req/${B}/${A}`, C));
await expect('A withdraws own request (not allowed, it expires)', 'deny', del(`halls/r1/req/${B}/${A}`, A));

console.log('\n# groups');
const group = (host) => ({ host, cr: TS, plant: 'sunflower', dur: 25, st: 'lobby', at: 0, members: { [host]: { n: 'Bob', a: 2, m: 'in', j: TS } } });
await expect('B creates group ABCDE', 'allow', put('groups/ABCDE', B, group(B)));
await expect('C overwrites the live group', 'deny', put('groups/ABCDE', C, group(C)));
await expect('C creates a group for B (host spoof)', 'deny', put('groups/QWERT', C, group(B)));
await expect('C creates a group with a lowercase code', 'deny', put('groups/abcde', C, group(C)));
await expect('A reads ABCDE before joining', 'deny', get('groups/ABCDE', A));
await expect('A joins a missing group', 'deny', put(`groups/ZZZZZ/members/${A}`, A, { n: 'Alice', a: 1, m: 'in' }));

console.log('\n# answering');
const ans = (r, g) => ({ t: TS, q: qt, r, ...(g ? { g } : {}) });
await expect('C answers for B', 'deny', put(`halls/r1/ans/${A}/${B}`, C, ans('y', 'ABCDE')));
await expect('B accepts with a group B is not in', 'deny', patch('halls/r1', B, { [`ans/${A}/${B}`]: ans('y', 'QQQQQ') }));
await expect('B accepts with a wrong request stamp', 'deny', put(`halls/r1/ans/${A}/${B}`, B, { t: TS, q: 1, r: 'y', g: 'ABCDE' }));
await expect('B accepts (+ clears the request, one update)', 'allow', patch('halls/r1', B, { [`ans/${A}/${B}`]: ans('y', 'ABCDE'), [`req/${B}/${A}`]: null }));
await expect('B answers the same request twice', 'deny', put(`halls/r1/ans/${A}/${B}`, B, ans('n')));
await expect("C reads A's answers", 'deny', get(`halls/r1/ans/${A}`, C));
await expect('A reads own answers', 'allow', get(`halls/r1/ans/${A}`, A));
await expect('A clears own answers', 'allow', del(`halls/r1/ans/${A}`, A));

console.log('\n# membership + reading');
await expect('A joins ABCDE', 'allow', put(`groups/ABCDE/members/${A}`, A, { n: 'Alice', a: 1, m: 'in', j: TS }));
await expect('A reads ABCDE as a member', 'allow', get('groups/ABCDE', A));
await expect('D adds A again (impersonation)', 'deny', put(`groups/ABCDE/members/${A}`, D, { n: 'Evil', a: 1, m: 'in' }));
await expect('D writes a member node for C', 'deny', put(`groups/ABCDE/members/${C}`, D, { n: 'Cara', a: 1, m: 'in' }));
await expect('D (not a member) reads ABCDE', 'deny', get('groups/ABCDE', D));
await expect('D reads the chat only', 'deny', get('groups/ABCDE/chat', D));
await expect('A fakes a join time', 'deny', patch(`groups/ABCDE/members/${A}`, A, { j: 5 }));
await expect('A member node with an extra field', 'deny', patch(`groups/ABCDE/members/${A}`, A, { x: 'hi' }));

console.log('\n# group chat');
const msg = (slot, x, n = 'Alice') => ({ [`chat/${A}/${slot}`]: { t: TS, x, n }, [`last/${A}`]: { t: TS, k: slot } });
await expect('A sends a message', 'allow', patch('groups/ABCDE', A, msg('m0', 'hello bob!')));
await expect('A sends again at once (1.5 s limit)', 'deny', patch('groups/ABCDE', A, msg('m1', 'spam')));
await sleep(1600);
await expect('A sends after 1.6 s', 'allow', patch('groups/ABCDE', A, msg('m1', 'ok now')));
await sleep(1600);
await expect('A sends 201 chars', 'deny', patch('groups/ABCDE', A, msg('m2', 'x'.repeat(201))));
await expect('A sends under a fake name', 'deny', patch('groups/ABCDE', A, msg('m2', 'hi', 'Bob')));
await expect('A sends without the rate stamp', 'deny', put(`groups/ABCDE/chat/${A}/m2`, A, { t: TS, x: 'hi', n: 'Alice' }));
await expect('A writes slot m25 (outside the ring)', 'deny', patch('groups/ABCDE', A, msg('m25', 'hi')));
await expect("A writes into B's messages", 'deny', patch('groups/ABCDE', A, { [`chat/${B}/m0`]: { t: TS, x: 'fake', n: 'Bob' }, [`last/${A}`]: { t: TS, k: 'm0' } }));
await expect('D (not a member) sends', 'deny', patch('groups/ABCDE', D, { [`chat/${D}/m0`]: { t: TS, x: 'hi', n: 'Dan' }, [`last/${D}`]: { t: TS, k: 'm0' } }));
await expect('B replies', 'allow', patch('groups/ABCDE', B, { [`chat/${B}/m0`]: { t: TS, x: 'hi alice', n: 'Bob' }, [`last/${B}`]: { t: TS, k: 'm0' } }));
await expect("A deletes B's messages", 'deny', del(`groups/ABCDE/chat/${B}`, A));
await expect('A resets own rate stamp', 'deny', del(`groups/ABCDE/last/${A}`, A));
await expect('A prunes own old message', 'allow', del(`groups/ABCDE/chat/${A}/m0`, A));

console.log('\n# focus together');
await expect('A ends the focus before it started', 'deny', patch('groups/ABCDE', A, { st: 'done', res: 'bloom' }));
await expect('A starts the focus (any member)', 'allow', patch('groups/ABCDE', A, { st: 'running', at: TS }));
await expect('A changes the plant mid-focus', 'deny', patch('groups/ABCDE', A, { plant: 'rose' }));
await expect('A finishes 25 min early', 'deny', patch('groups/ABCDE', A, { st: 'done', res: 'bloom' }));
await expect('D marks the plant resting', 'deny', put('groups/ABCDE/rest', D, true));
await expect('A leaves mid-focus (rest + leave, one update)', 'allow', patch('groups/ABCDE', A, { rest: true, [`members/${A}`]: null }));
await expect('A reads after leaving', 'deny', get('groups/ABCDE', A));
await expect('A chats after leaving', 'deny', patch('groups/ABCDE', A, msg('m3', 'still here?')));
await put('groups/ABCDE/at', 'ADMIN', Date.now() - 26 * 60_000);
await expect('B settles the result when time is up', 'allow', patch('groups/ABCDE', B, { st: 'done', res: 'rest' }));
await expect('B starts another round (reset)', 'allow', patch('groups/ABCDE', B, { st: 'lobby', at: 0, res: null, rest: null }));
await expect('C deletes B group', 'deny', del('groups/ABCDE', C));
await expect('B (host) deletes the group', 'allow', del('groups/ABCDE', B));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
