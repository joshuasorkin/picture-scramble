import type { Retention, ReturnRate, ReturnWindow } from "@/lib/analytics/retention";
import { formatCount, formatDay, formatPercent } from "./format";

const WINDOWS: { key: ReturnWindow; label: string; note: string }[] = [
  { key: "d1", label: "D1 return", note: "back the next day" },
  { key: "d7", label: "D7 return", note: "back within 7 days" },
  { key: "d30", label: "D30 return", note: "back within 30 days" },
];

function RateCell({ rate }: { rate: ReturnRate | null }) {
  if (!rate) {
    return (
      <td className="zero" title="Window hasn't fully passed yet">
        …
      </td>
    );
  }
  if (!rate.visitors) return <td className="zero">–</td>;
  return (
    <td className={rate.returned ? "" : "zero"}>
      {formatPercent(rate.rate)}{" "}
      <span className="stats-muted">
        {formatCount(rate.returned)}/{formatCount(rate.visitors)}
      </span>
    </td>
  );
}

export default function RetentionTable({ retention }: { retention: Retention }) {
  const { cohorts, total } = retention;
  const newestFirst = [...cohorts].reverse();

  return (
    <>
      <section className="stats-tiles stats-tiles-3" aria-label="Return rate for the range">
        {WINDOWS.map(({ key, label, note }) => {
          const rate = total[key];
          return (
            <div key={key} className="stats-card stats-tile">
              <span className="stats-tile-label">{label}</span>
              <span className="stats-tile-value">
                {rate?.visitors ? formatPercent(rate.rate) : "–"}
              </span>
              <span className="stats-muted">
                {rate?.visitors
                  ? `${formatCount(rate.returned)} of ${formatCount(rate.visitors)} new visitors ${note}`
                  : `new visitors ${note}`}
              </span>
            </div>
          );
        })}
      </section>

      <section className="stats-card stats-table-card">
        <h2>Return rate by first day</h2>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">First day</th>
                <th scope="col">New visitors</th>
                <th scope="col">D1</th>
                <th scope="col">D7</th>
                <th scope="col">D30</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((c) => (
                <tr key={c.date}>
                  <td>{formatDay(c.date, true)}</td>
                  <td className={c.visitors ? "" : "zero"}>{formatCount(c.visitors)}</td>
                  <RateCell rate={c.d1} />
                  <RateCell rate={c.d7} />
                  <RateCell rate={c.d30} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Whole range</td>
                <td>{formatCount(cohorts.reduce((n, c) => n + c.visitors, 0))}</td>
                <RateCell rate={total.d1} />
                <RateCell rate={total.d7} />
                <RateCell rate={total.d30} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  );
}
