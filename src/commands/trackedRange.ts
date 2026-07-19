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
  const mapBoundary = (offset: number, includeInsertion: boolean): number => {
    let delta = 0;
    for (const change of sorted) {
      const changeStart = change.rangeOffset;
      const changeEnd = changeStart + change.rangeLength;
      if (change.rangeLength === 0 && changeStart === offset) {
        if (includeInsertion && empty) delta += change.text.length;
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
    return change.rangeLength === 0
      ? empty
        ? change.rangeOffset === start
        : change.rangeOffset >= start && change.rangeOffset < end
      : change.rangeOffset < end && changeEnd > start;
  });
  return {
    start: mapBoundary(start, false),
    end: mapBoundary(end, true),
    changed,
  };
}
