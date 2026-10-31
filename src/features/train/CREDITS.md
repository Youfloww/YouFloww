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

## Window footage (`public/video/train/*.mp4|webp`)

Real looping train-window video, cropped to the view outside the glass, scaled to 960 px wide, audio removed, and
cross-faded into a seamless loop. Originals are kept outside the repo. Mixkit clips need no attribution; credit is given anyway.

| File | Shows | Source | Author | Licence |
| --- | --- | --- | --- | --- |
| `alpine.mp4` | green meadow, forested cliffs and mountains (Swiss valley) | Mixkit, ["Train trip through nature"](https://mixkit.co/free-stock-video/train-trip-through-nature-3024/) (#3024) | not credited on Mixkit | [Mixkit Free License](https://mixkit.co/license/#videoFree) |
| `lake.mp4` | lakeside villages, trees and fences | Mixkit, ["Train trip near country houses"](https://mixkit.co/free-stock-video/train-trip-near-country-houses-3023/) (#3023) | not credited on Mixkit | [Mixkit Free License](https://mixkit.co/license/#videoFree) |
| `plains.mp4` | overcast farmland and meadows | Mixkit, ["Countryside racing past the train"](https://mixkit.co/free-stock-video/countryside-racing-past-the-train-27715/) (#27715) | not credited on Mixkit | [Mixkit Free License](https://mixkit.co/license/#videoFree) |
| `snow.mp4` | snowy forest across a frozen lake (cropped from inside the window) | Pexels, ["Winter view from train window on snowy day"](https://www.pexels.com/video/winter-view-from-train-window-on-snowy-day-34800955/) | Laura Santos | [Pexels License](https://www.pexels.com/license/) |
| `steppe.mp4` | dry plains under a blue sky (cropped) | Pexels, ["Scenery from the window of a moving train"](https://www.pexels.com/video/scenery-from-the-window-of-a-moving-train-5949269/) | Hemza Chaour | [Pexels License](https://www.pexels.com/license/) |
| `dusk.mp4` | sunset over trees and fields, blurred by speed | Pexels, ["Train ride through rural landscape at sunset"](https://www.pexels.com/video/train-ride-through-rural-landscape-at-sunset-37130587/) | K (@kelly) | [Pexels License](https://www.pexels.com/license/) |
