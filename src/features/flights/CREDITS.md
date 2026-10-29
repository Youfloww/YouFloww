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
