export const clampReturnRate = (
  value: number,
  min: number,
  max: number,
): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};
