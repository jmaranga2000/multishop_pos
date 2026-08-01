export function hasPriceMismatchBetweenMinorUnits(serverPriceMinor: number, offlinePriceMinor: number) {
  return Math.abs(serverPriceMinor - offlinePriceMinor) > 1;
}
