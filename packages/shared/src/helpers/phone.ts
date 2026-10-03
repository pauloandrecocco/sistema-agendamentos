/** Keeps only the digits of a phone number (accepts masked input). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
