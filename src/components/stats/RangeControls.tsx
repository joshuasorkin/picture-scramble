import { addDays, todayIn } from "@/lib/analytics/dates";

const PRESET_DAYS = [7, 14, 30, 90];

const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
  "Europe/London",
  "Europe/Madrid",
];

interface Props {
  statsKey: string;
  from: string;
  to: string;
  timezone: string;
}

export default function RangeControls({ statsKey, from, to, timezone }: Props) {
  const today = todayIn(timezone);
  const href = (start: string) =>
    `?${new URLSearchParams({ key: statsKey, from: start, to: today, tz: timezone })}`;
  const timezones = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  return (
    <div className="stats-range">
      <nav className="stats-presets" aria-label="Date range presets">
        {PRESET_DAYS.map((n) => {
          const start = addDays(today, -(n - 1));
          return (
            <a key={n} href={href(start)} aria-current={from === start && to === today}>
              {n}d
            </a>
          );
        })}
      </nav>

      <form className="stats-custom" method="get">
        <input type="hidden" name="key" value={statsKey} />
        <label>
          From
          <input type="date" name="from" defaultValue={from} max={today} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={to} max={today} />
        </label>
        <label>
          Timezone
          <select name="tz" defaultValue={timezone}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Apply</button>
      </form>
    </div>
  );
}
