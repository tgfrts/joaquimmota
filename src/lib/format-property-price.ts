/** Portuguese grouping, decimal comma and trailing euro sign. */
export function formatPropertyPrice(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  const number = new Intl.NumberFormat('pt-PT', { useGrouping: true, maximumFractionDigits: 2 }).format(amount)
    .replace(/[\u00a0\u202f]/g, ' ');
  return `${number} €`;
}
