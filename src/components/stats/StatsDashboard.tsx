import type { Stats } from "@/lib/analytics/stats";
import DailyChart from "./DailyChart";
import RangeControls from "./RangeControls";
import { formatAverage, formatCount, formatDay } from "./format";

interface Props {
  stats: Stats;
  statsKey: string;
  error?: string;
}

export default function StatsDashboard({ stats, statsKey, error }: Props) {
  const { total, days, from, to, timezone } = stats;
  const newestFirst = [...days].reverse();

  return (
    <main className="stats-page">
      <header className="stats-header">
        <h1>Utu&apos;s Wild Words · Stats</h1>
        <span className="stats-subtle">
          {formatDay(from)} – {formatDay(to)} · {timezone.replace(/_/g, " ")}
        </span>
      </header>

      <RangeControls statsKey={statsKey} from={from} to={to} timezone={timezone} />
      {error && <p className="stats-error">{error} — showing the default range.</p>}

      <section className="stats-tiles" aria-label="Totals for the range">
        <div className="stats-card stats-tile stats-tile-hero">
          <span className="stats-tile-label">Unique visitors</span>
          <span className="stats-tile-value">{formatCount(total.visitors)}</span>
          <span className="stats-muted">each counted once in the range</span>
        </div>
        <div className="stats-card stats-tile">
          <span className="stats-tile-label">Visits per visitor</span>
          <span className="stats-tile-value">{formatAverage(total.visitsPerVisitor)}</span>
          <span className="stats-muted">{formatCount(total.visits)} visits</span>
        </div>
        <div className="stats-card stats-tile">
          <span className="stats-tile-label">Puzzles played per visitor</span>
          <span className="stats-tile-value">{formatAverage(total.roundsPerVisitor)}</span>
          <span className="stats-muted">{formatCount(total.rounds)} played</span>
        </div>
        <div className="stats-card stats-tile">
          <span className="stats-tile-label">Puzzles solved per visitor</span>
          <span className="stats-tile-value">{formatAverage(total.solvedPerVisitor)}</span>
          <span className="stats-muted">{formatCount(total.solved)} solved</span>
        </div>
      </section>

      <section className="stats-tiles stats-tiles-3" aria-label="Sharing totals for the range">
        <div className="stats-card stats-tile">
          <span className="stats-tile-label">Shares</span>
          <span className="stats-tile-value">{formatCount(total.shares)}</span>
          <span className="stats-muted">taps of the Share button</span>
        </div>
        <div className="stats-card stats-tile">
          <span className="stats-tile-label">Shared puzzles played</span>
          <span className="stats-tile-value">{formatCount(total.sharedPlayed)}</span>
          <span className="stats-muted">opened from a share link</span>
        </div>
        <div className="stats-card stats-tile">
          <span className="stats-tile-label">Visits from share links</span>
          <span className="stats-tile-value">{formatCount(total.shareVisits)}</span>
          <span className="stats-muted">visits that started on a share link</span>
        </div>
      </section>

      {total.visitors === 0 ? (
        <p className="stats-card stats-subtle">No visits recorded in this range yet.</p>
      ) : (
        <DailyChart days={days} />
      )}

      <section className="stats-card stats-table-card">
        <h2>Daily breakdown</h2>
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Visitors</th>
                <th scope="col">Visits / visitor</th>
                <th scope="col">Played / visitor</th>
                <th scope="col">Solved / visitor</th>
                <th scope="col">Shares</th>
                <th scope="col">Shared played</th>
                <th scope="col">Share visits</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((d) => (
                <tr key={d.date}>
                  <td>{formatDay(d.date, true)}</td>
                  <td className={d.visitors ? "" : "zero"}>{formatCount(d.visitors)}</td>
                  <td className={d.visitors ? "" : "zero"}>{formatAverage(d.visitsPerVisitor)}</td>
                  <td className={d.visitors ? "" : "zero"}>{formatAverage(d.roundsPerVisitor)}</td>
                  <td className={d.visitors ? "" : "zero"}>{formatAverage(d.solvedPerVisitor)}</td>
                  <td className={d.shares ? "" : "zero"}>{formatCount(d.shares)}</td>
                  <td className={d.sharedPlayed ? "" : "zero"}>{formatCount(d.sharedPlayed)}</td>
                  <td className={d.shareVisits ? "" : "zero"}>{formatCount(d.shareVisits)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Whole range</td>
                <td>{formatCount(total.visitors)}</td>
                <td>{formatAverage(total.visitsPerVisitor)}</td>
                <td>{formatAverage(total.roundsPerVisitor)}</td>
                <td>{formatAverage(total.solvedPerVisitor)}</td>
                <td>{formatCount(total.shares)}</td>
                <td>{formatCount(total.sharedPlayed)}</td>
                <td>{formatCount(total.shareVisits)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="stats-muted">
        A visit ends after 30 minutes without activity. A puzzle counts as played once it is
        shown. Visitors in the whole-range row are counted once, so it is not the sum of the days.
        Shares count on the day the shared puzzle was played, since each tap isn&apos;t timestamped.
      </p>
    </main>
  );
}
