export interface TogetherData {
  animal: number;
  name: string;
  working: string;
  /** team blooms earned */
  blooms: number;
  given: number;
  got: number;
  history: { key: string; at: number; dur: number; n: number; res: 'bloom' | 'rest'; plant: string }[];
}
export const EMPTY_DATA: TogetherData = { animal: 0, name: '', working: '', blooms: 0, given: 0, got: 0, history: [] };
