/** YouTube links and the IFrame API, shared by the wallpaper and the music player. */

/** A pasted link: a video, a playlist, or a video inside a playlist. */
export interface YouTubeLink {
  id: string | null;
  list: string | null;
}

/** Watch Later, Liked videos and similar lists are private, so they can never play in an embed. */
const PRIVATE_LIST = /^(WL|LL|LM)$/;

export function parseYouTube(input: string): YouTubeLink | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return { id: s, list: null };
  if (/^(PL|OLAK5uy_|UU|FL|RD)[\w-]{10,}$/.test(s)) return { id: null, list: s };
  const id = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/)?.[1] ?? null;
  let list = s.match(/[?&]list=([\w-]+)/)?.[1] ?? null;
  if (list && PRIVATE_LIST.test(list)) list = null;
  return id || list ? { id, list } : null;
}

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

export type YTPlayer = {
  playVideo(): void;
  mute(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getDuration(): number;
  getCurrentTime(): number;
  getVideoData?(): { isLive?: boolean; title?: string; video_id?: string };
  nextVideo(): void;
  previousVideo(): void;
  playVideoAt(index: number): void;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  destroy(): void;
};
type YTNamespace = { Player: new (el: HTMLElement, opts: object) => YTPlayer };

let ytApi: Promise<YTNamespace> | null = null;
export function loadYouTubeApi() {
  ytApi ??= new Promise((resolve) => {
    const w = window as unknown as { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void };
    if (w.YT?.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT!);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApi;
}

/** Player options for a video, a playlist, or a playlist starting at one of its videos. */
export const playerSource = ({ id, list }: YouTubeLink) => ({
  ...(id ? { videoId: id } : {}),
  vars: list ? { listType: 'playlist', list } : {},
});

/** Where the player is in its playlist (count 0 = a single video). */
export function playlistPos(p: YTPlayer) {
  try {
    return { index: Math.max(0, p.getPlaylistIndex()), count: p.getPlaylist()?.length ?? 0 };
  } catch {
    return { index: 0, count: 0 };
  }
}

/** Step through the playlist, wrapping from the last video to the first and back. */
export function stepPlaylist(p: YTPlayer, dir: 1 | -1) {
  const { index, count } = playlistPos(p);
  if (count < 2) return p.seekTo(0, true);
  p.playVideoAt((index + dir + count) % count);
}
