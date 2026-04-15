/** Equirectangular projection to percentage positions (0–100) for a static world map. */

export function lonToXPercent(lon: number): number {
  return ((lon + 180) / 360) * 100;
}

export function latToYPercent(lat: number): number {
  return ((90 - lat) / 180) * 100;
}
