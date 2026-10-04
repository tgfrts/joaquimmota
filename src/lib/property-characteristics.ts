/** Missing, zero and invalid numeric characteristics have no public indicator. */
export function hasPropertyCharacteristic(value: unknown): boolean {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && !value.trim()) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0;
}
