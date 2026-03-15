export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Safety margin applied to calculated fuel range.
 * 80% = fill up when 20% of tank remains. Better early than stranded.
 */
const FUEL_SAFETY_MARGIN = 0.8;

/**
 * Absolute minimum range we'll plan for, regardless of bike specs.
 * No route segment should exceed this without a fuel stop.
 */
export const MIN_FUEL_RANGE_KM = 100;

/**
 * Compute bike fuel range in km with safety margin.
 * Uses manual override if set, otherwise calculates from tank + consumption.
 * Applies 20% safety margin and enforces minimum of 100km.
 */
export function computeRangeKm(bike: {
  tankLitres: number;
  consumptionPer100km: number;
  isManualRange: boolean;
  manualRangeKm: number | null;
}): number {
  if (bike.isManualRange && bike.manualRangeKm !== null) {
    // Still apply safety margin to manual range
    return Math.max(bike.manualRangeKm * FUEL_SAFETY_MARGIN, MIN_FUEL_RANGE_KM);
  }
  const raw = (bike.tankLitres / bike.consumptionPer100km) * 100;
  return Math.max(raw * FUEL_SAFETY_MARGIN, MIN_FUEL_RANGE_KM);
}

/**
 * Compute raw range without safety margin (for display purposes).
 */
export function computeRawRangeKm(bike: {
  tankLitres: number;
  consumptionPer100km: number;
  isManualRange: boolean;
  manualRangeKm: number | null;
}): number {
  if (bike.isManualRange && bike.manualRangeKm !== null) {
    return bike.manualRangeKm;
  }
  return (bike.tankLitres / bike.consumptionPer100km) * 100;
}
