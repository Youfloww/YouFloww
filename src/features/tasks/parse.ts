export interface ParsedTask {
  text: string;
  estimateMinutes: number;
  tag: string | null;
  starred: boolean;
}

/**
 * "Write essay 45m #school !"  -> { text: 'Write essay', estimate: 45, tag: 'school', starred }
 * Supports 1h, 1.5h, 90m, 90min, ~30, #tag, ! or * for priority.
 */
export function parseTask(input: string): ParsedTask {
  let s = ` ${input} `;
  let estimate = 0;
  let tag: string | null = null;
  let starred = false;

  s = s.replace(/\s(\d+(?:\.\d+)?)\s?(h|hr|hrs|hours?)\b/i, (_, n) => {
    estimate += Math.round(parseFloat(n) * 60);
    return ' ';
  });
  s = s.replace(/\s(\d+)\s?(m|min|mins|minutes?)\b/i, (_, n) => {
    estimate += parseInt(n, 10);
    return ' ';
  });
  s = s.replace(/\s~(\d+)\b/, (_, n) => {
    estimate += parseInt(n, 10);
    return ' ';
  });
  s = s.replace(/\s#([\p{L}\p{N}_-]{1,30})/u, (_, t) => {
    tag = t;
    return ' ';
  });
  s = s.replace(/\s[!*]+(?=\s)/, () => {
    starred = true;
    return ' ';
  });

  return { text: s.replace(/\s+/g, ' ').trim(), estimateMinutes: Math.min(estimate, 600), tag, starred };
}
