"""No progress lost: signed in behind a network that blocks Firebase, a session + a task survive closing the browser
and reach the server later; a guest's session, coins and task join an existing account.
Local only: the dev server (npm run dev; E2E_URL to use another port) + this folder's Auth/Firestore emulators
9299/8288 (`sh src/services/rules-test/run.sh e2e`). Every non-local request is aborted."""
import json, os, shutil, sys, tempfile, time, urllib.request
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

URL = os.environ.get('E2E_URL', 'http://127.0.0.1:5173/')
HERE = tempfile.mkdtemp(prefix='floww-e2e-')
FS = 'http://127.0.0.1:8288/v1/projects/youfloww2/databases/(default)/documents/users/'
INIT = "sessionStorage.setItem('floww:emu','1'); sessionStorage.setItem('floww:emuPorts','9299,8288');"
QUEUE = """async () => new Promise((res) => { const r = indexedDB.open('firestore/[DEFAULT]/youfloww2/main');
  r.onsuccess = () => { try { const db = r.result; const t = db.transaction('mutations', 'readonly').objectStore('mutations').count();
    t.onsuccess = () => { res(t.result); db.close(); }; t.onerror = () => res(-2); } catch (e) { res(String(e)); } }; r.onerror = () => res(-1); })"""
MODS = """window.__m = async () => ({ data: (await import('/src/store/data.ts')).useData, sync: await import('/src/services/sync.ts'),
  engine: await import('/src/features/timer/engine.ts'), timer: (await import('/src/store/timer.ts')).useTimer });"""
SESSION = """async ([todo]) => { const m = await window.__m(); m.engine.start(); const t = Date.now() - 600_000;
  m.timer.setState({ runStartedAt: t, sessionStartedAt: t, endAt: t + 1500_000 });
  if (todo) m.data.getState().addTodo(todo); m.engine.endEarly(); }"""
LOCAL = """async () => { const d = (await window.__m()).data.getState(); return { user: d.user?.uid ?? null, sync: d.sync,
  sessions: d.data.totalSessions, sec: d.data.totalFocusSeconds, coins: d.data.wallet?.coins ?? 0, todos: d.data.todos.map(t => t.text) }; }"""

state = {'blocked': False}
live, errors, failed = set(), [], []


def ok(c, m):
    print(('PASS  ' if c else 'FAIL  ') + m)
    if not c:
        failed.append(m)


def route(r):
    u = urlparse(r.request.url)
    if u.hostname not in ('127.0.0.1', 'localhost') or u.path == '/sw.js':
        live.add(u.hostname)
        return r.abort()
    if state['blocked'] and u.port in (8288, 9299):
        return r.abort()
    r.continue_()


def val(v):
    if 'integerValue' in v: return int(v['integerValue'])
    if 'doubleValue' in v: return v['doubleValue']
    if 'stringValue' in v: return v['stringValue']
    if 'booleanValue' in v: return v['booleanValue']
    if 'nullValue' in v: return None
    if 'mapValue' in v: return {k: val(x) for k, x in v['mapValue'].get('fields', {}).items()}
    if 'arrayValue' in v: return [val(x) for x in v['arrayValue'].get('values', [])]
    return v


def server(uid):
    req = urllib.request.Request(FS + uid, headers={'Authorization': 'Bearer owner'})
    d = {k: val(v) for k, v in json.load(urllib.request.urlopen(req))['fields'].items()}
    return {'sessions': d.get('totalSessions', 0), 'sec': d.get('totalFocusSeconds', 0), 'coins': (d.get('wallet') or {}).get('coins', 0),
            'todos': [t['text'] for t in d.get('todos', [])], 'log': len(d.get('sessionLog', []))}


def browser(p, profile):
    ctx = p.chromium.launch_persistent_context(profile, channel='chrome', headless=True, viewport={'width': 1200, 'height': 800})
    ctx.add_init_script(INIT)
    ctx.add_init_script(MODS)
    ctx.route('**/*', route)
    pg = ctx.pages[0] if ctx.pages else ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(URL, wait_until='load')
    pg.wait_for_function('window.__m', timeout=20000)
    return ctx, pg


# Waits go through pg.wait_for_timeout, never time.sleep: the sync API runs ctx.route handlers only inside a
# Playwright call, so during a plain sleep every request the page makes (Firestore's listen channel too) stalls.
def wait_local(pg, cond, secs=25):
    end = time.time() + secs
    while time.time() < end:
        s = pg.evaluate(LOCAL)
        if cond(s): return s
        pg.wait_for_timeout(400)
    return pg.evaluate(LOCAL)


def wait_server(pg, uid, cond, secs=30):
    end = time.time() + secs
    while time.time() < end:
        s = server(uid)
        if cond(s): return s
        pg.wait_for_timeout(500)
    return server(uid)


P1, P2 = f'{HERE}/prof1', f'{HERE}/prof2'
for d in (P1, P2): shutil.rmtree(d, ignore_errors=True)
email = f'e2e{int(time.time())}@example.test'

with sync_playwright() as p:
    # --- A. signed in, Firebase blocked: work survives closing the browser --------------------------------------
    ctx, pg = browser(p, P1)
    pg.evaluate('async ([e]) => (await window.__m()).sync.signUpWithEmail(e, "test-pass-123", "E2E")', [email])
    s = wait_local(pg, lambda s: s['user'] and s['sync'] == 'saved')
    uid = s['user']
    s0 = wait_server(pg, uid, lambda x: True)
    print('account', uid, 'server', s0)

    state['blocked'] = True
    pg.reload(wait_until='load')
    pg.wait_for_function('window.__m', timeout=20000)
    s = wait_local(pg, lambda s: s['user'] == uid, 15)
    pg.wait_for_timeout(3000)  # the cached copy shows
    ok(s['user'] == uid, 'blocked network: still signed in, account copy from this device')
    pg.evaluate(SESSION, ['offline task'])
    after = pg.evaluate(LOCAL)
    ok(after['sessions'] == s0['sessions'] + 1 and after['coins'] > s0['coins'] and 'offline task' in after['todos'], f'session + coins + task on screen ({after})')
    pg.wait_for_timeout(400)  # well inside the old 1.2 s save delay
    q = pg.evaluate(QUEUE)
    ok(isinstance(q, int) and q >= 1, f'the writes wait in the Firestore offline queue on this device ({q} queued)')
    ctx.close()

    ctx, pg = browser(p, P1)  # reopened, still blocked
    s = wait_local(pg, lambda s: s['user'] == uid and s['sessions'] > s0['sessions'], 25)
    ok(s['sessions'] == s0['sessions'] + 1 and 'offline task' in s['todos'], f'reopened while still blocked: the work is still there ({s})')
    ok(server(uid)['sessions'] == s0['sessions'], 'and the server has not seen it yet (blocked)')
    ctx.close()

    state['blocked'] = False
    ctx, pg = browser(p, P1)  # reopened with a working network
    wait_local(pg, lambda s: s['sync'] == 'saved', 20)
    s1 = wait_server(pg, uid, lambda x: x['sessions'] == s0['sessions'] + 1 and 'offline task' in x['todos'])
    ok(s1['sessions'] == s0['sessions'] + 1 and s1['sec'] >= s0['sec'] + 595 and s1['log'] == s0['log'] + 1, f'back online: the server has the session ({s1})')
    ok(s1['coins'] == after['coins'] and 'offline task' in s1['todos'], 'and its coins and the task')
    pg.reload(wait_until='load')
    pg.wait_for_timeout(5000)
    s2 = server(uid)
    ok(s2['sessions'] == s1['sessions'] and s2['coins'] == s1['coins'], f'another reload counts nothing twice ({s2})')
    ctx.close()

    # --- B. a guest's work joins the existing account -----------------------------------------------------------
    ctx, pg = browser(p, P2)
    pg.wait_for_timeout(2000)
    pg.evaluate(SESSION, ['guest task'])
    g = pg.evaluate(LOCAL)
    pg.wait_for_timeout(300)
    blob = pg.evaluate("() => JSON.parse(localStorage.getItem('youfloww_guest') || 'null')")
    ok(blob and len(blob.get('sessionLog', [])) == 1 and g['user'] is None, f'guest: session saved on this device at once ({g})')
    pg.evaluate("""() => { window.__seen = ''; new MutationObserver(() => { const m = document.body.innerText.match(/\\d+ guest sessions? added to your account\\./); if (m) window.__seen = m[0]; })
      .observe(document.body, { subtree: true, childList: true, characterData: true }); }""")
    pg.evaluate('async ([e]) => (await window.__m()).sync.signInWithEmail(e, "test-pass-123")', [email])
    s3 = wait_server(pg, uid, lambda x: x['sessions'] == s2['sessions'] + 1 and 'guest task' in x['todos'])
    ok(s3['sessions'] == s2['sessions'] + 1 and s3['sec'] >= s2['sec'] + 595, f'sign-in: the guest session joined the account ({s3})')
    ok(s3['coins'] == s2['coins'] + g['coins'], f"and the guest's {g['coins']} coins ({s2['coins']} -> {s3['coins']})")
    ok('guest task' in s3['todos'] and 'offline task' in s3['todos'], "and the guest's task, next to the account's")
    left = pg.evaluate("() => localStorage.getItem('youfloww_guest')")
    ok(left is None, 'guest copy cleared (never merged into a second account)')
    seen = pg.evaluate('window.__seen')
    ok(seen == '1 guest session added to your account.', f'the user is told: "{seen}"')
    pg.reload(wait_until='load')
    pg.wait_for_timeout(5000)
    s4 = server(uid)
    ok(s4['sessions'] == s3['sessions'] and s4['coins'] == s3['coins'] and s4['todos'].count('guest task') == 1, 'reload: nothing merged twice')
    ctx.close()

shutil.rmtree(HERE, ignore_errors=True)
print('non-local hosts (all aborted):', sorted(h for h in live if h) or 'none')
print('page errors:', errors or 'none')
print('ALL PASSED' if not failed else f'{len(failed)} FAILED')
sys.exit(1 if failed else 0)
