# Focus Flights: sources and licences

| What | Source | Licence |
| --- | --- | --- |
| Airports (IATA, name, city, country, lat/lon, size) in `public/data/flights/airports.json` | [OurAirports](https://ourairports.com/data/) (`airports.csv`, large + medium airports with IATA codes and scheduled service) | Public domain |
| Airport time zones (merged into the same file) | [mwgg/Airports](https://github.com/mwgg/Airports) `airports.json` | MIT (© 2014 mwgg) |
| Country outlines in `public/data/flights/countries.json` | [Natural Earth](https://www.naturalearthdata.com/) 1:110m admin-0 countries, simplified to SVG paths | Public domain |
| Satellite imagery on the flight map | [Sentinel-2 cloudless 2016](https://s2maps.eu) by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), tiles from `tiles.maps.eox.at` (`s2cloudless_3857`, the 2016 layer) | CC BY 4.0, credited on screen |
| Map renderer | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) v6 (already a dependency) | BSD-3-Clause |
| Country names | the browser's `Intl.DisplayNames`; flags are Unicode regional-indicator emoji | no library |
| Barcode | Code 128 (set B) encoder written for this feature | ours |
| Plane, window, takeoff, stamps, seat map, split-flap board | hand-made SVG/CSS for YouFloww | ours |
| Cat by the window | the app's own sprite (`src/features/cat`) | as in the cat feature |

Data was built with a small script (OurAirports CSV + mwgg time zones, nearest-airport time zone for the 64 airports
missing one; Natural Earth GeoJSON → equirectangular SVG paths clipped at 60°S, Antarctica dropped).

## Cabin window footage (`public/video/flight/*.mp4|webp`)

Real plane-window video from Mixkit (no attribution required; credited anyway), audio removed, scaled to 960 px wide and
cross-faded into a seamless loop. Mixkit does not name the filmmakers on its clip pages. Licence for all: [Mixkit Free License](https://mixkit.co/license/#videoFree).

| File | Shows | Source |
| --- | --- | --- |
| `day-wing.mp4` | wing and blue sky over white clouds | ["Looking at the sky from the window of an airplane"](https://mixkit.co/free-stock-video/looking-at-the-sky-from-the-window-of-an-airplane-3099/) (#3099) |
| `day-clouds.mp4` | wing over a bright cloud sea | ["Cloud landscape from an airplane window"](https://mixkit.co/free-stock-video/cloud-landscape-from-an-airplane-window-7179/) (#7179) |
| `sunset-pink.mp4` | pink and lilac sunset above scattered clouds | ["Pink sunset seen from a plane window"](https://mixkit.co/free-stock-video/pink-sunset-seen-from-a-plane-window-4204/) (#4204) |
| `sunset-gold.mp4` | golden horizon with the wing | ["Slowly peering out of an airplane window"](https://mixkit.co/free-stock-video/slowly-peering-out-of-an-airplane-window-40101/) (#40101) |
| `night-city.mp4` | wing over a city at night under storm clouds | ["Plane flying over a city at night"](https://mixkit.co/free-stock-video/plane-flying-over-a-city-at-night-3361/) (#3361) |
| `night-dusk.mp4` | deep dusk glow behind the wing | ["Panorama from the window of an airplane at dusk"](https://mixkit.co/free-stock-video/panorama-from-the-window-of-an-airplane-at-dusk-40102/) (#40102) |
