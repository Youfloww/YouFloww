/**
 * Window Seat views. Videos are YouTube embeds (no API key, nothing downloaded): 24/7 live streams and long
 * window-view loops, all checked as embeddable. The painted window needs no network and follows your session.
 */
export interface Scene {
  id: string;
  label: string;
  emoji: string;
  /** YouTube video id; none = the painted window */
  yt?: string;
  live?: boolean;
  /** loop length in seconds, to open somewhere in the middle instead of at the title card */
  len?: number;
  /** a few words about it, shown in the picker */
  note: string;
}

export const SCENES: Scene[] = [
  { id: 'tokyo', label: 'Rainy Tokyo', emoji: '🗼', yt: 'WxYejo5gfyM', len: 10800, note: 'Rain on the glass, Tokyo Tower' },
  { id: 'cabin', label: 'Snowy cabin', emoji: '❄️', yt: 'M29up1tNcL0', live: true, note: 'Snow falling, all day and night' },
  { id: 'nycwinter', label: 'NYC winter night', emoji: '🌃', yt: '_YCQf3N9R_Q', live: true, note: 'Manhattan in the snow' },
  { id: 'glasshouse', label: 'Glasshouse study', emoji: '🪴', yt: 'RD929GWcPxo', len: 10861, note: 'A study room in a rainy forest' },
  { id: 'ocean', label: 'Ocean window', emoji: '🏝️', yt: 'zHD5kgHjKj4', len: 10802, note: 'Turquoise sea, soft waves' },
  { id: 'sunset', label: 'Sunset sea', emoji: '🌅', yt: 'y8FDJYper4g', len: 3612, note: 'An open window on a glowing beach' },
  { id: 'forest', label: 'Rainy forest', emoji: '🌲', yt: 'zBPOjdWtPBc', len: 29288, note: 'A dark, calm afternoon of rain' },
  { id: 'paris', label: 'Paris by day', emoji: '🥐', yt: 'rchqJlo1jQs', len: 10801, note: 'The Eiffel Tower, quiet streets' },
  { id: 'parisrain', label: 'Rainy Paris night', emoji: '🌧️', yt: 'IRRhUYyT7Yg', len: 42897, note: 'Rain and the lit tower' },
  { id: 'nycrain', label: 'NYC rain', emoji: '🏙️', yt: 'FFjWJzCTf4g', len: 42901, note: 'Rain over the skyline' },
  { id: 'beach', label: 'Tropical beach', emoji: '🌊', yt: '_BMi3usEwi8', live: true, note: 'Waves rolling in, live' },
  { id: 'painted', label: 'Painted day', emoji: '🎨', note: 'Dawn to night as your session runs · works offline' },
];

export const DEFAULT_SCENE = 'tokyo';
export const sceneOf = (id: string | undefined) => SCENES.find((s) => s.id === id) ?? SCENES[0];
export const thumbOf = (s: Scene, size: 'mq' | 'maxres' = 'mq') => (s.yt ? `https://i.ytimg.com/vi/${s.yt}/${size}default.jpg` : '/img/window/morning.webp');
