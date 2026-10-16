const countFormat = new Intl.NumberFormat("en-US");
const averageFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const formatCount = (n: number) => countFormat.format(n);
export const formatAverage = (n: number) => averageFormat.format(n);

// Day strings are calendar dates, so format them in UTC to avoid shifting.
export function formatDay(day: string, withWeekday = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withWeekday ? { weekday: "short" } : {}),
  });
}
