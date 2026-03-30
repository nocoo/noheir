export const clampSavingsRate = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
};

export const getSavingsRateTone = (value: number): "low" | "ok" | "high" => {
  if (value < 30) return "low";
  if (value > 70) return "high";
  return "ok";
};
