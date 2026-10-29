export type Paper = 'day' | 'sepia' | 'night';

export interface DocInfo {
  pages: number;
  /** a page's size in CSS px at 100% */
  pageWidth: number;
  pageHeight: number;
  /** text that reflows to the window (no fixed page width) */
  fluid?: boolean;
}

/** Draw a small preview of page `page` into `host`, `width` px wide. Returns a cleanup. */
export type ThumbFn = (page: number, host: HTMLElement, width: number) => (() => void) | void;

export interface ViewerProps {
  file: File;
  /** CSS scale, 1 = 100% */
  scale: number;
  scroller: HTMLDivElement;
  /** phone layout: reflow Word documents into one column */
  reflow: boolean;
  onInfo: (i: DocInfo) => void;
  onError: (msg: string) => void;
  /** a small picture of the first page for the recent-files shelf */
  onCover?: (b: Blob) => void;
  thumbRef: { current: ThumbFn | null };
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
