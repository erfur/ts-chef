export type OffsetChange = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

export function transformTrackedRange(
  start: number,
  end: number,
  changes: readonly OffsetChange[],
): { start: number; end: number; changed: boolean } {
  const sorted = [...changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
  const empty = start === end;
  const prefixLength = (text: string): number => {
    const newline = text.search(/[\r\n]/);
    return newline === -1 ? text.length : newline;
  };
  const mapBoundary = (offset: number, includeInsertion: boolean): number => {
    let delta = 0;
    for (const change of sorted) {
      const changeStart = change.rangeOffset;
      const changeEnd = changeStart + change.rangeLength;
      if (change.rangeLength === 0 && changeStart === offset) {
        if (includeInsertion)
          delta += empty ? change.text.length : prefixLength(change.text);
        continue;
      }
      if (changeEnd <= offset) {
        delta += change.text.length - change.rangeLength;
        continue;
      }
      if (changeStart >= offset) break;
      return changeStart + delta + (includeInsertion ? change.text.length : 0);
    }
    return offset + delta;
  };
  const changed = sorted.some((change) => {
    const changeEnd = change.rangeOffset + change.rangeLength;
    if (change.rangeLength !== 0)
      return change.rangeOffset < end && changeEnd > start;
    if (empty) return change.rangeOffset === start;
    if (change.rangeOffset >= start && change.rangeOffset < end) return true;
    return change.rangeOffset === end && prefixLength(change.text) > 0;
  });
  return {
    start: mapBoundary(start, false),
    end: mapBoundary(end, true),
    changed,
  };
}
