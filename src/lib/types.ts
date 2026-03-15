export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Compute bike fuel range in km.
 * Uses manual override if set, otherwise calculates from tank + consumption.
 */
export function computeRangeKm(bike: {
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
