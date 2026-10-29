# Study Hall ("together") — integration notes

## 1. One-time Firebase console steps (project `youfloww2`, Spark plan is enough)
1. **Build > Realtime Database > Create database** (any location; pick the same region you prefer). Start in *locked mode*.
   If the console shows a database URL other than `https://youfloww2-default-rtdb.firebaseio.com`
   (e.g. `https://youfloww2-default-rtdb.europe-west1.firebasedatabase.app`), put it in `CONFIG.databaseURL` in `src/features/together/rt.ts`.
2. **Build > Authentication > Sign-in method > Anonymous > Enable.** (Guests get a seat with this. If it stays off, the hall
   shows a friendly "Continue with Google" button instead.)
3. **Realtime Database > Rules**: paste the JSON below (it is also saved as `src/features/together/database.rules.json`;
   optionally add `"database": { "rules": "src/features/together/database.rules.json" }` to `firebase.json`
   and run `firebase deploy --only database`).
4. Authentication > Settings > Authorized domains must include the live domain (already needed for Google sign-in).

The hall uses its own secondary Firebase app (`together`) with its own anonymous auth, so it never touches the main
account, Firestore sync or `useData.user`.

## 2. Shared-file changes for the lead (all optional, nothing else is needed)
- **Invite links** `https://<site>/?together=ABCDE`: `src/App.tsx` strips the query string right after boot, so in `useAppEffects`
  (the "deep links" effect) add:
  ```ts
  const t = p.get('together');
  if (t) { try { sessionStorage.setItem('together:invite', t); } catch {} useUI.getState().set({ mode: 'together' }); }
  ```
  The hall reads `together:invite` (or `?together=` if still present), asks the person to pick an animal, then joins the group.
- The mode appears in the Worlds launcher and command menu by itself (meta.ts, key `v`, order 60).
- Nothing was added to the bus; it listens to existing `tab:away`, `tab:back`, `session:early`, and emits `confetti` / `mascot:say`.

## 3. Data model
```
halls/{r1..r50}/seats/{s0..s11} = { u uid, n name<=20, a animal 0-7, w working-on<=40, s f|b|i|p, e endsAt|remaining(ms), d duration(ms), h heartbeat, g groupCode }
halls/{rid}/kudos/{toUid}/{fromUid} = { t serverTime, k hf|kd|yg, c count }
groups/{ABCDE} = { host, cr, plant, dur(5-180 min), st lobby|running|done, at startedAt, res bloom|rest,
                  members/{uid}: { n, a, m in|away|left|out } }
```
- Rooms shard automatically: a person takes the first free seat of `r1`, then `r2`, ... (12 seats each). The rules make the 12-seat cap structural
  (slot keys `s0..s11`, a slot can only be claimed when empty), so two people can never share a seat.
- Writes: one seat write on entering, one on each timer state change (start/pause/mode), one heartbeat per minute (only while the tab is visible).
  Reads: one `get` per hall tried, then two listeners (seats, kudos). `onDisconnect` removes the seat and our kudos node.
- Seats silent for 5 minutes are hidden by clients; anyone may delete a seat silent for 10 minutes (ghost cleaning).
- On leaving the hall (mode closes): seat removed, all listeners detached, `goOffline`, `deleteApp`. Nothing connects while the hall is closed.
- Kudos: 1 per sender per receiver per 2 minutes, enforced in the rules (`t` must equal server time, the previous `t` must be older than 2 min, `c` must grow by exactly 1).
- Group `at` is the server time of the start; every client derives the shared timer from it (`serverTimeOffset`), so clocks never matter.

## 4. Known rule limits (RTDB rules cannot do these)
- A group's member count (12) is enforced by the client only (rules have no `numChildren`).
- A person could in theory occupy several seat slots of one hall with several anonymous accounts; accepted for a free feature.
- Old groups are not deleted automatically (reads of groups older than 6 hours are refused; the data is tiny). Wipe `/groups` now and then in the console if wished.

## 5. Testing against the emulator
```
cd <scratch> && cat > firebase.json <<'EOF2'
{"database":{"rules":"<repo>/src/features/together/database.rules.json"},"emulators":{"database":{"port":9000},"auth":{"port":9099},"ui":{"enabled":false}}}
EOF2
npx firebase-tools emulators:start --only database,auth --project demo-youfloww
```
Then open the app with `localStorage['together:emu']='1'` (or `?emu=1` on the first load of the rt module): the hall uses
`connectAuthEmulator` + `connectDatabaseEmulator` against project `demo-youfloww`.

## 6. Realtime Database rules (paste into the console)
```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "halls": {
      "$rid": {
        ".validate": "$rid.matches(/^r([1-9]|[1-4][0-9]|50)$/)",
        "seats": {
          ".read": "auth != null",
          "$slot": {
            ".validate": "$slot.matches(/^s([0-9]|1[01])$/) && newData.hasChildren(['u', 'n', 'a', 's', 'h'])",
            ".write": "auth != null && ((!data.exists() && newData.child('u').val() === auth.uid) || data.child('u').val() === auth.uid || (!newData.exists() && data.child('h').val() < now - 600000))",
            "u": { ".validate": "newData.isString() && newData.val() === auth.uid" },
            "n": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 20" },
            "a": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 7 && newData.val() % 1 === 0" },
            "w": { ".validate": "newData.isString() && newData.val().length <= 40" },
            "s": { ".validate": "newData.isString() && (newData.val() === 'f' || newData.val() === 'b' || newData.val() === 'i' || newData.val() === 'p')" },
            "e": { ".validate": "newData.isNumber()" },
            "d": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 21600000" },
            "h": { ".validate": "newData.isNumber() && newData.val() <= now + 5000" },
            "g": { ".validate": "newData.isString() && newData.val().matches(/^[A-Z]{0,5}$/)" },
            "$other": { ".validate": false }
          }
        },
        "kudos": {
          ".read": "auth != null",
          "$to": {
            ".write": "auth != null && auth.uid === $to && !newData.exists()",
            "$from": {
              ".write": "auth != null && auth.uid === $from && $from !== $to && (!data.exists() || data.child('t').val() < now - 120000)",
              ".validate": "newData.hasChildren(['t', 'k', 'c']) && newData.child('t').val() === now && newData.child('c').val() === (data.exists() ? data.child('c').val() + 1 : 1)",
              "t": { ".validate": "newData.isNumber()" },
              "k": { ".validate": "newData.isString() && (newData.val() === 'hf' || newData.val() === 'kd' || newData.val() === 'yg')" },
              "c": { ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 100000" },
              "$other": { ".validate": false }
            }
          }
        },
        "$other": { ".validate": false }
      }
    },
    "groups": {
      "$code": {
        ".validate": "$code.matches(/^[A-Z]{5}$/)",
        ".read": "auth != null && (data.child('cr').val() > now - 21600000)",
        ".write": "auth != null && (((!data.exists() || data.child('cr').val() < now - 21600000) && newData.child('host').val() === auth.uid) || (data.child('host').val() === auth.uid && !newData.exists()))",
        "host": { ".validate": "newData.isString()" },
        "cr": { ".validate": "newData.isNumber() && newData.val() <= now + 5000" },
        "plant": { ".validate": "newData.isString() && (newData.val() === 'sunflower' || newData.val() === 'tulip' || newData.val() === 'rose' || newData.val() === 'lavender' || newData.val() === 'sakura')" },
        "dur": { ".validate": "newData.isNumber() && newData.val() >= 5 && newData.val() <= 180 && newData.val() % 1 === 0" },
        "st": {
          ".write": "auth != null && ((data.parent().child('host').val() === auth.uid && data.val() === 'lobby' && newData.val() === 'running') || (data.parent().child('members').child(auth.uid).exists() && data.val() === 'running' && newData.val() === 'done' && now >= data.parent().child('at').val() + data.parent().child('dur').val() * 60000 - 5000))",
          ".validate": "newData.isString() && (newData.val() === 'lobby' || newData.val() === 'running' || newData.val() === 'done')"
        },
        "at": {
          ".write": "auth != null && data.parent().child('host').val() === auth.uid && data.val() === 0 && data.parent().child('st').val() === 'lobby'",
          ".validate": "newData.isNumber() && (newData.val() === 0 || newData.val() === now)"
        },
        "res": {
          ".write": "auth != null && !data.exists() && data.parent().child('members').child(auth.uid).exists() && data.parent().child('st').val() !== 'lobby'",
          ".validate": "newData.isString() && (newData.val() === 'bloom' || newData.val() === 'rest')"
        },
        "members": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid && (!newData.exists() || data.exists() || root.child('groups/' + $code + '/st').val() === 'lobby')",
            ".validate": "newData.hasChildren(['n', 'a', 'm'])",
            "n": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 20" },
            "a": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 7 && newData.val() % 1 === 0" },
            "m": { ".validate": "newData.isString() && (newData.val() === 'in' || newData.val() === 'away' || newData.val() === 'left' || newData.val() === 'out')" },
            "$other": { ".validate": false }
          }
        },
        "$other": { ".validate": false }
      }
    }
  }
}
```
