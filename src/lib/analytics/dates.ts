// Calendar-day helpers for stats. Days are "YYYY-MM-DD" strings in a named
// IANA timezone, so ranges mean the same thing as the dates people see.

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().startsWith(day);
}

// Today's date in the given timezone.
export function todayIn(timezone: string, now = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

export function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// Every day from `from` to `to`, inclusive.
export function daysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}
