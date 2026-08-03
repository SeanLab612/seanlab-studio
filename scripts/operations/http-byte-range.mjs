export const parseSingleByteRange = (header, size) => {
  if (!Number.isSafeInteger(size) || size <= 0) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header ?? ""));
  if (!match || (!match[1] && !match[2])) return undefined;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return undefined;
    const length = Math.min(suffixLength, size);
    return { start: size - length, end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  )
    return undefined;
  return { start, end: Math.min(requestedEnd, size - 1) };
};
