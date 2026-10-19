const countFormat = new Intl.NumberFormat("en-US");
const averageFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const percentFormat = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

export const formatCount = (n: number) => countFormat.format(n);
export const formatAverage = (n: number) => averageFormat.format(n);
export const formatPercent = (n: number) => percentFormat.format(n);

// Day strings are calendar dates, so format them in UTC to avoid shifting.
export function formatDay(day: string, withWeekday = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withWeekday ? { weekday: "short" } : {}),
  });
}
