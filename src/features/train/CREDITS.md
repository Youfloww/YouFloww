# Scenic Train: credits & licences

| What | Where it is used | Source | Licence |
| --- | --- | --- | --- |
| Railway track geometry and station names/positions | `public/data/train/*.geojson` (built by `tools/build_routes.py`) | © OpenStreetMap contributors, via the Overpass API | ODbL 1.0 (attribution: "© OpenStreetMap contributors"; the derived data stays ODbL) |
| Satellite imagery in the window | streamed at ride time from `tiles.maps.eox.at` (layer `s2cloudless_3857`) | Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), https://s2maps.eu | CC BY 4.0 |
| 3D terrain | streamed from `s3.amazonaws.com/elevation-tiles-prod/terrarium` | Terrain Tiles (Mapzen / AWS Open Data). Sources: SRTM, GMTED2010, ETOPO1, NED, and others (see https://github.com/tilezen/joerd/blob/master/docs/attribution.md) | Open data, attribution as listed there |
| Map renderer | `maplibre-gl` (already a dependency), loaded only inside the ride | MapLibre GL JS | BSD-3-Clause |
| Chai glass on the window sill | `public/img/cafe/chai.webp` (the café's own art, reused) | YouFloww | own art |
| Curtains, pelmet, window frame, route vignettes, stamps | drawn in code (SVG/CSS) in this folder | YouFloww | own work |
| Train ambience | none bundled: the "rumble" button switches on the app's own brown-noise track in the mixer | YouFloww | own work |

The credits line "© OpenStreetMap contributors · Sentinel-2 cloudless 2016 by EOX (CC BY 4.0) · Terrain: Mapzen/AWS Terrain Tiles" is shown on the platform screen and in the window during a ride.
