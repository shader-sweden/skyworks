export function getPageHeightUnit() {
  if (typeof window === "undefined") return 0;

  return window.innerHeight;
}

export function pageHeightUnitsToPixels(units: number) {
  return units * getPageHeightUnit();
}

export function pixelsToPageHeightUnits(pixels: number) {
  const unit = getPageHeightUnit();

  if (unit === 0) return 0;

  return pixels / unit;
}
