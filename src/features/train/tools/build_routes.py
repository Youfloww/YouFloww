"""Build public/data/train/<id>.geojson from OpenStreetMap (Overpass API). Data © OpenStreetMap contributors, ODbL.

python3 build_routes.py [route ids...]      (raw Overpass answers are cached in $TRAIN_OSM_CACHE)

For each route: fetch every rail way in a corridor around the curated stations, build a graph of the track,
walk the shortest path station → station, cut out the tunnels, simplify, and write compact GeoJSON:
  - one LineString (properties: id, km, tunnels [[fromKm, toKm], ...])
  - one Point per station (properties: name, km, motif, note)
"""
import heapq, json, math, os, subprocess, sys, time

sys.path.insert(0, os.path.dirname(__file__))
from routes_src import ROUTES  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '../../../../public/data/train'))
CACHE = os.environ.get('TRAIN_OSM_CACHE', '/tmp/train-osm')
ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]


def overpass(q, cache_file):
    if os.path.exists(cache_file) and os.path.getsize(cache_file) > 200:
        return json.load(open(cache_file))
    for attempt in range(8):
        url = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            raw = subprocess.run(['curl', '-s', '-f', '-m', '400', '-A', 'YouFloww-train-data/1.0 (cozy focus app)', '--data-urlencode', 'data=' + q, url],
                                 capture_output=True, check=True).stdout
            data = json.loads(raw)
            if not data.get('elements'):
                raise RuntimeError('empty answer: ' + str(data.get('remark', ''))[:200])
            open(cache_file, 'wb').write(raw)
            return data
        except Exception as e:  # noqa: BLE001
            print(f'   overpass {url.split("/")[2]} failed ({str(e)[:160]}); retrying', flush=True)
            time.sleep(10 + attempt * 10)
    raise RuntimeError('overpass gave up')


def hav(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    p = math.pi / 180
    h = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(h))


def gauge_ok(tags, gauge):
    if not gauge or 'gauge' not in tags:
        return True
    return gauge in tags['gauge'].split(';')


def build(route):
    rid = route['id']
    st = route['stations']
    pts = ','.join(f'{lat:.4f},{lon:.4f}' for _, lat, lon, *_ in st)
    q = ('[out:json][timeout:300];'
         + '(' + ''.join(f'way{f}(around:{route["radius"]},{pts});' for f in (route['filter'] if isinstance(route['filter'], list) else [route['filter']])) + ');out body geom qt;'
         f'(node["railway"~"^(station|halt)$"](around:{route["radius"]},{pts}););out body qt;')
    os.makedirs(CACHE, exist_ok=True)
    data = overpass(q, os.path.join(CACHE, f'{rid}.json'))

    coords, adj, way_count = {}, {}, 0
    stations_osm = []
    for el in data['elements']:
        if el['type'] == 'node':
            stations_osm.append(el)
            continue
        tags = el.get('tags', {})
        if not gauge_ok(tags, route.get('gauge')):
            continue
        if route.get('highspeed') and not (tags.get('highspeed') == 'yes' or '新幹線' in tags.get('name', '')):
            continue
        if tags.get('railway') not in ('rail', 'narrow_gauge'):
            continue
        way_count += 1
        tunnel = tags.get('tunnel') in ('yes', 'building_passage', 'avalanche_protector', 'culvert')
        ids, geom = el['nodes'], el['geometry']
        for nid, g in zip(ids, geom):
            coords[nid] = (g['lat'], g['lon'])
        for a, b in zip(ids, ids[1:]):
            d = hav(coords[a], coords[b])
            adj.setdefault(a, []).append((b, d, tunnel))
            adj.setdefault(b, []).append((a, d, tunnel))
    print(f'  {rid}: {way_count} ways, {len(coords)} nodes, {len(stations_osm)} station nodes', flush=True)

    # heal small gaps in the data: dead ends close to another track node get a (slightly costly) link
    grid = {}
    cell = 0.0006
    for nid, (la, lo) in coords.items():
        grid.setdefault((int(la / cell), int(lo / cell)), []).append(nid)
    healed = 0
    for nid, edges in list(adj.items()):
        if len(edges) != 1:
            continue
        la, lo = coords[nid]
        gx, gy = int(la / cell), int(lo / cell)
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for m in grid.get((gx + dx, gy + dy), []):
                    if m == nid or any(e[0] == m for e in adj[nid]):
                        continue
                    d = hav(coords[nid], coords[m])
                    if d < route.get('heal', 40) and (best is None or d < best[1]):
                        best = (m, d)
        if best:
            adj[nid].append((best[0], best[1] * 3 + 5, False))
            adj[best[0]].append((nid, best[1] * 3 + 5, False))
            healed += 1

    # snap only onto the biggest connected piece of track (stray sidings and fragments are ignored)
    comp, main = {}, set()
    for start in adj:
        if start in comp:
            continue
        seen, stack = {start}, [start]
        while stack:
            u = stack.pop()
            for v, *_ in adj.get(u, []):
                if v not in seen:
                    seen.add(v)
                    stack.append(v)
        for u in seen:
            comp[u] = start
        if len(seen) > len(main):
            main = seen
    # bridge bigger fragments onto the main line when the gap is small (mapping gaps at stations etc.)
    groups = {}
    for u, c in comp.items():
        groups.setdefault(c, set()).add(u)
    for g in sorted(groups.values(), key=len, reverse=True):
        if g is main or len(g) < 15 or g & main:
            continue
        best = None
        for a in g:
            la, lo = coords[a]
            gx, gy = int(la / cell), int(lo / cell)
            r = int(route.get('heal', 40) / 60) + 1
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    for m in grid.get((gx + dx, gy + dy), []):
                        if m in main:
                            d = hav(coords[a], coords[m])
                            if d < route.get('heal', 40) and (best is None or d < best[0]):
                                best = (d, a, m)
        if best:
            d, a, m = best
            adj[a].append((m, d * 3 + 5, False))
            adj[m].append((a, d * 3 + 5, False))
            main = main | g
            healed += 1

    def nearest(lat, lon):
        best, bd = None, 1e18
        for nid, c in coords.items():
            if nid not in main:
                continue
            d = hav((lat, lon), c)
            if d < bd:
                best, bd = nid, d
        return best, bd

    def norm(s):
        return ''.join(ch for ch in s.lower() if ch.isalnum())

    # snap the curated stations to real OSM stations (by name), then to the track
    snapped = []
    for name, lat, lon, hint, motif, note in st:
        cands = [n for n in stations_osm if any(norm(hint) == norm(n.get('tags', {}).get(k, '')) for k in ('name', 'name:en', 'official_name', 'alt_name'))]
        if not cands:
            cands = [n for n in stations_osm if norm(hint) and any(norm(hint) in norm(n.get('tags', {}).get(k, '')) for k in ('name', 'name:en'))]
        if cands:
            c = min(cands, key=lambda n: hav((lat, lon), (n['lat'], n['lon'])))
            if hav((lat, lon), (c['lat'], c['lon'])) < 15000:
                lat, lon = c['lat'], c['lon']
            else:
                cands = []
        nid, d = nearest(lat, lon)
        snapped.append((name, nid, d, motif, note, bool(cands)))
        flag = 'osm' if cands else 'APPROX'
        print(f'    {name:22s} {flag:6s} {d:7.0f} m from track', flush=True)

    def dijkstra(s, t):
        dist, prev, h = {s: 0}, {}, [(0, s)]
        while h:
            d, u = heapq.heappop(h)
            if u == t:
                break
            if d > dist.get(u, 1e18):
                continue
            for v, w, _ in adj.get(u, []):
                nd = d + w
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    prev[v] = u
                    heapq.heappush(h, (nd, v))
        if t not in dist:
            return None
        path = [t]
        while path[-1] != s:
            path.append(prev[path[-1]])
        return path[::-1]

    nodes = []
    for (n1, a, *_), (n2, b, *_) in zip(snapped, snapped[1:]):
        if a == b:
            continue
        p = dijkstra(a, b)
        if p is None:
            raise RuntimeError(f'{rid}: no track path {n1} -> {n2}')
        nodes += p if not nodes else p[1:]

    line = [coords[n] for n in nodes]
    cum = [0.0]
    tunnel_flags = []
    for a, b in zip(nodes, nodes[1:]):
        e = next((e for e in adj[a] if e[0] == b), None)
        tunnel_flags.append(bool(e and e[2]))
        cum.append(cum[-1] + hav(coords[a], coords[b]))
    total = cum[-1]

    tunnels, start = [], None
    for i, t in enumerate(tunnel_flags + [False]):
        if t and start is None:
            start = cum[i]
        if not t and start is not None:
            if cum[i] - start >= 350:
                if tunnels and start - tunnels[-1][1] < 120:
                    tunnels[-1][1] = cum[i]
                else:
                    tunnels.append([start, cum[i]])
            start = None

    km_of = {}
    for name, nid, *_ in snapped:
        idxs = [i for i, n in enumerate(nodes) if n == nid]
        km_of[name] = cum[idxs[0]] / 1000 if idxs else None

    # Douglas-Peucker in local metres
    lat0 = sum(c[0] for c in line) / len(line)
    kx = 111320 * math.cos(math.radians(lat0))
    P = [(c[1] * kx, c[0] * 110540) for c in line]
    tol = 8 if total < 80000 else 14 if total < 250000 else 22
    keep = [False] * len(P)
    keep[0] = keep[-1] = True
    stack = [(0, len(P) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = P[i]
        bx, by = P[j]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-9
        md, mk = -1, -1
        for k in range(i + 1, j):
            px, py = P[k]
            d = abs(dy * (px - ax) - dx * (py - ay)) / L
            if d > md:
                md, mk = d, k
        if md > tol:
            keep[mk] = True
            stack += [(i, mk), (mk, j)]
    simp = [[round(line[k][1], 5), round(line[k][0], 5)] for k in range(len(line)) if keep[k]]

    feats = [{'type': 'Feature', 'properties': {'id': rid, 'km': round(total / 1000, 2), 'tunnels': [[round(a / 1000, 3), round(b / 1000, 3)] for a, b in tunnels]},
              'geometry': {'type': 'LineString', 'coordinates': simp}}]
    for name, nid, d, motif, note, _ in snapped:
        if motif is None or km_of.get(name) is None:
            continue
        c = coords[nid]
        feats.append({'type': 'Feature', 'properties': {'name': name, 'km': round(km_of[name], 2), 'motif': motif, 'note': note},
                      'geometry': {'type': 'Point', 'coordinates': [round(c[1], 5), round(c[0], 5)]}})
    os.makedirs(OUT, exist_ok=True)
    fc = {'type': 'FeatureCollection', 'attribution': '© OpenStreetMap contributors (ODbL)', 'features': feats}
    path = os.path.join(OUT, f'{rid}.geojson')
    json.dump(fc, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
    print(f'  -> {rid}: {total / 1000:.1f} km, {len(simp)} points, {len(tunnels)} tunnels, healed {healed}, {os.path.getsize(path) // 1024} KB', flush=True)


if __name__ == '__main__':
    want = sys.argv[1:]
    for r in ROUTES:
        if want and r['id'] not in want:
            continue
        print('==', r['id'], flush=True)
        try:
            build(r)
        except Exception as e:  # noqa: BLE001
            print('  FAILED', r['id'], e, flush=True)
