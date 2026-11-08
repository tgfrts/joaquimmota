/** Conservative format checks: reject obvious placeholders, not valid country-specific prefixes. */
export function isPlausiblePhone(value: string): boolean {
  const phone = value.trim();
  if (!phone || !/^\+?[0-9\s().-]+$/u.test(phone)) return false;
  let digits = phone.replace(/\D/gu, '');
  if (phone.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return false;
  const international = phone.startsWith('+') || phone.startsWith('00');
  const portuguese = international && digits.startsWith('351');
  const national = portuguese ? digits.slice(3) : digits;
  if (!national || /^(\d)\1+$/u.test(national)) return false;
  // For other explicit country codes, reject an otherwise entirely repeated subscriber number.
  if (international && !portuguese && /^[1-9]\d{0,2}(\d)\1{6,}$/u.test(digits)) return false;
  const ascending = '01234567890123456789';
  const descending = '98765432109876543210';
  return !ascending.includes(national) && !descending.includes(national);
}
