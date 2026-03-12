
export const TIMEZONE = 'America/New_York';

export function formatDate(date: Date | string | number, options: Intl.DateTimeFormatOptions = {}) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { timeZone: TIMEZONE, ...options });
}

export function formatTime(date: Date | string | number, options: Intl.DateTimeFormatOptions = {}) {
  const d = new Date(date);
  return d.toLocaleTimeString([], { timeZone: TIMEZONE, ...options });
}

export function formatDateTime(date: Date | string | number, options: Intl.DateTimeFormatOptions = {}) {
  const d = new Date(date);
  return d.toLocaleString(undefined, { timeZone: TIMEZONE, ...options });
}

export function formatDateISO(date: Date | string | number) {
  const d = new Date(date);
  const year = d.toLocaleDateString('en-US', { timeZone: TIMEZONE, year: 'numeric' });
  const month = d.toLocaleDateString('en-US', { timeZone: TIMEZONE, month: '2-digit' });
  const day = d.toLocaleDateString('en-US', { timeZone: TIMEZONE, day: '2-digit' });
  return `${year}-${month}-${day}`;
}
