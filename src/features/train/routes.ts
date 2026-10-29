/** The Scenic Train timetable: real railways (track + stations from OpenStreetMap, in /data/train/<id>.geojson). */

export interface RouteInfo {
  id: string;
  name: string;
  from: string;
  to: string;
  flag: string;
  country: string;
  blurb: string;
  /** stamp ink + accents */
  color: string;
  /** length (km) and stations, from the OSM data */
  km: number;
  stops: number;
  /** painted vignette for the platform board (optional) */
  art?: string;
}

export const ROUTES: RouteInfo[] = [
  { id: 'konkan', name: 'Konkan Railway', from: 'Mumbai', to: 'Goa', flag: '🇮🇳', country: 'India', blurb: 'Monsoon-green valleys, high bridges and the Arabian Sea', km: 0, stops: 0, color: '#2f8a63' },
  { id: 'darjeeling', name: 'Darjeeling Toy Train', from: 'New Jalpaiguri', to: 'Darjeeling', flag: '🇮🇳', country: 'India', blurb: 'Loops and zig-zags up to the tea gardens', km: 0, stops: 0, color: '#2f64a8' },
  { id: 'kalka-shimla', name: 'Kalka–Shimla', from: 'Kalka', to: 'Shimla', flag: '🇮🇳', country: 'India', blurb: '102 tunnels and pine-scented hills', km: 0, stops: 0, color: '#b8502f' },
  { id: 'nilgiri', name: 'Nilgiri Mountain Railway', from: 'Mettupalayam', to: 'Ooty', flag: '🇮🇳', country: 'India', blurb: 'A rack railway through tea and eucalyptus', km: 0, stops: 0, color: '#2c76a0' },
  { id: 'kandy-ella', name: 'Kandy to Ella', from: 'Kandy', to: 'Ella', flag: '🇱🇰', country: 'Sri Lanka', blurb: 'Misty tea country to the Nine Arch Bridge', km: 0, stops: 0, color: '#1d8070' },
  { id: 'bernina', name: 'Bernina Express', from: 'St. Moritz', to: 'Tirano', flag: '🇨🇭', country: 'Switzerland', blurb: 'Glaciers, Lago Bianco and a spiral viaduct', km: 0, stops: 0, color: '#c0303a' },
  { id: 'glacier', name: 'Glacier Express', from: 'Zermatt', to: 'St. Moritz', flag: '🇨🇭', country: 'Switzerland', blurb: 'Matterhorn to Engadin over the Oberalp Pass', km: 0, stops: 0, color: '#a8283a' },
  { id: 'bergen', name: 'Bergen Line', from: 'Oslo', to: 'Bergen', flag: '🇳🇴', country: 'Norway', blurb: 'Across the frozen roof of Norway', km: 0, stops: 0, color: '#c23b3b' },
  { id: 'flam', name: 'Flåm Railway', from: 'Myrdal', to: 'Flåm', flag: '🇳🇴', country: 'Norway', blurb: 'Waterfalls all the way down to the fjord', km: 0, stops: 0, color: '#2b7a4b' },
  { id: 'west-highland', name: 'West Highland Line', from: 'Glasgow', to: 'Mallaig', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', country: 'Scotland', blurb: 'Lochs, moors and the Glenfinnan Viaduct', km: 0, stops: 0, color: '#5f4a9a' },
  { id: 'shinkansen', name: 'Tōkaidō Shinkansen', from: 'Tokyo', to: 'Kyoto', flag: '🇯🇵', country: 'Japan', blurb: 'Bullet train past Mount Fuji', km: 0, stops: 0, color: '#2a62ad' },
  { id: 'rockies', name: 'Canadian Rockies', from: 'Banff', to: 'Kamloops', flag: '🇨🇦', country: 'Canada', blurb: 'Spiral tunnels, glaciers and turquoise rivers', km: 0, stops: 0, color: '#22807f' },
];

export const routeOf = (id: string) => ROUTES.find((r) => r.id === id);

/** Session lengths offered on the ticket (minutes) */
export const LENGTHS = [15, 25, 45, 60, 90];
